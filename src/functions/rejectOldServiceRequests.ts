import { InvocationContext, Timer } from "@azure/functions";
import { NotificationClient } from "login.dfe.jobs-client";
import { Op } from "sequelize";
import {
  connection,
  DatabaseName,
} from "../infrastructure/database/common/connection";
import {
  initialiseUserServiceRequest,
  UserServiceRequest,
} from "../infrastructure/database/organisations/UserServiceRequest";
import { Access } from "../infrastructure/api/dsiInternal/Access";
import { Applications } from "../infrastructure/api/dsiInternal/Applications";
import { Directories } from "../infrastructure/api/dsiInternal/Directories";
import { Organisations } from "../infrastructure/api/dsiInternal/Organisations";
import { AuditLogger } from "../infrastructure/AuditLogger";
import { checkEnv } from "../infrastructure/utils";
import { filterResults } from "./utils/filterResults";

const targetDate = new Date();
targetDate.setMonth(targetDate.getMonth() - 3);

const statusFilter = [2, 3];

const rejectionReason =
  "Automated task - Approvers did not action request within 3 months";

type rejectionEmailInfo = {
  email: string;
  firstName: string;
  lastName: string;
  orgName: string;
  serviceName: string;
  requestedSubServices: string[];
};

async function rejectServiceRequest(
  request: UserServiceRequest,
  accessApi: Access,
  correlationId: string,
): Promise<{
  object: UserServiceRequest;
  success: boolean;
}> {
  const success = await accessApi.updateServiceRequest(
    request.id,
    {
      status: -1,
      actioned_by: process.env.SUPPORT_USER_ID,
      actioned_at: Date.now(),
      actioned_reason: rejectionReason,
    },
    correlationId,
  );
  return { object: request, success };
}

/**
 * Sends rejection emails to the users using the standard service request rejected template.
 *
 * @param emailInfo - An array of {@link rejectionEmailInfo} objects that need rejection emails to be sent.
 * @param notificationClient - {@link NotificationClient} to queue the email sending jobs.
 * @returns {Promise<void[]>}
 */
async function sendRejectionEmails(
  emailInfo: rejectionEmailInfo[],
  notificationClient: NotificationClient,
): Promise<void[]> {
  return Promise.all(
    emailInfo.map((info) =>
      notificationClient.sendServiceRequestRejected(
        info.email,
        info.firstName,
        info.lastName,
        info.orgName,
        info.serviceName,
        info.requestedSubServices,
        `The approver(s) at the organisation haven't taken any action on your request, which was made more than 3 months ago.`,
      ),
    ),
  );
}

/**
 * Retrieves information to use in the rejected request email template, for any active users linked to requests.
 *
 * @param requests - An array of {@link UserServiceRequest} objects that need emails to be sent.
 * @param directoriesApi - {@link Directories} API wrapper.
 * @param organisationsApi - {@link Organisations} API wrapper.
 * @param applicationsApi - {@link Applications} API wrapper.
 * @param correlationId - Correlation ID to be passed with the request.
 * @returns An array of {@link rejectionEmailInfo} elements to use in the rejected request email template.
 */
async function getEmailInfo(
  requests: UserServiceRequest[],
  directoriesApi: Directories,
  organisationsApi: Organisations,
  applicationsApi: Applications,
  correlationId: string,
): Promise<rejectionEmailInfo[]> {
  const activeUsers = (
    await directoriesApi.getUsersByIds(
      [...new Set(requests.map((r) => r.userId))],
      correlationId,
    )
  ).filter((user) => user.status === 1);

  const [orgResults, serviceResults] = await Promise.all([
    Promise.all(
      [...new Set(requests.map((r) => r.organisationId))].map((id) =>
        organisationsApi.getOrganisationById(id, correlationId),
      ),
    ),
    Promise.all(
      [...new Set(requests.map((r) => r.serviceId))].map((id) =>
        applicationsApi.getServiceById(id, correlationId),
      ),
    ),
  ]);

  const orgMap = new Map(
    orgResults
      .filter((o) => o !== null)
      .map((o) => [o.id, o.name ?? "Unknown Organisation"]),
  );
  const serviceMap = new Map(
    serviceResults
      .filter((s) => s !== null)
      .map((s) => [s.id, s.name]),
  );

  return requests
    .map((request) => {
      const user = activeUsers.find((u) => u.sub === request.userId);
      if (!user) return null;

      return {
        email: user.email,
        firstName: user.given_name,
        lastName: user.family_name,
        orgName: orgMap.get(request.organisationId) ?? "Unknown Organisation",
        serviceName: serviceMap.get(request.serviceId) ?? "Unknown Service",
        requestedSubServices: request.roleIds
          ? JSON.parse(request.roleIds)
          : [],
      };
    })
    .filter((info) => info !== null);
}

/**
 * Rejects service requests that are overdue or pending no-approver action and were created over 3 months ago.
 *
 * @param timer - Azure function {@link Timer} to handle scheduling information.
 * @param context - Azure function {@link InvocationContext} to log and retrieve invocation data.
 */
export async function rejectOldServiceRequests(
  timer: Timer,
  context: InvocationContext,
): Promise<void> {
  if (timer.isPastDue) {
    context.warn(
      "rejectOldServiceRequests: Timer is marked as past due, and attempted to run the function",
    );
    return;
  }

  try {
    checkEnv(
      ["REDIS_CONNECTION_STRING", "SUPPORT_USER_ID"],
      "valid request rejections or Redis",
    );

    const correlationId = context.invocationId;

    initialiseUserServiceRequest(connection(DatabaseName.Organisations));

    const access = new Access();
    const applications = new Applications();
    const directories = new Directories();
    const organisations = new Organisations();
    const auditLogger = new AuditLogger();
    const notificationClient = new NotificationClient({
      connectionString: `${process.env.REDIS_CONNECTION_STRING}/4?tls=true`,
    });

    context.info(
      "rejectOldServiceRequests: Retrieving overdue/no approver service requests",
    );

    const suitableRequests = await UserServiceRequest.findAll({
      attributes: [
        "id",
        "userId",
        "organisationId",
        "serviceId",
        "roleIds",
        "createdAt",
      ],
      where: {
        status: {
          [Op.in]: statusFilter,
        },
        createdAt: {
          [Op.lt]: targetDate,
        },
      },
    });

    if (suitableRequests.length === 0) {
      context.info(
        `rejectOldServiceRequests: No overdue/no approver service requests available older than ${targetDate.toLocaleDateString("en-GB")}`,
      );
      return;
    }

    context.info(
      `rejectOldServiceRequests: Rejecting ${suitableRequests.length} overdue/no approver service requests older than ${targetDate.toLocaleDateString("en-GB")}`,
    );

    const { successful, failed, errored } = filterResults(
      await Promise.allSettled(
        suitableRequests.map((request) =>
          rejectServiceRequest(request, access, correlationId),
        ),
      ),
    );

    context.info(
      `rejectOldServiceRequests: ${successful.count} successful, ${failed.count} failed, and ${errored.count} errored rejections for ${suitableRequests.length} service requests`,
    );

    if (errored.count > 0) {
      errored.errors.forEach((error) =>
        context.error(`rejectOldServiceRequests: ${error}`),
      );
    }

    if (errored.count === suitableRequests.length) {
      throw new Error(
        "All request rejections had an error, failing execution so it can retry.",
      );
    }

    if (successful.count > 0) {
      context.info(
        `rejectOldServiceRequests: Sending audit messages for the ${successful.count} successfully rejected requests`,
      );

      await auditLogger.batchedLog(
        successful.objects.map((request) => ({
          message: "Automated rejection of requests older than 3 months",
          type: "approver",
          subType: "rejected-service",
          userId: process.env.SUPPORT_USER_ID,
          organisationid: request.organisationId,
          meta: {
            editedUser: request.userId,
            reason: rejectionReason,
          },
        })),
      );

      context.info(
        `rejectOldServiceRequests: Retrieving user information for the ${successful.count} successfully rejected requests`,
      );

      const emailInfo = await getEmailInfo(
        successful.objects,
        directories,
        organisations,
        applications,
        correlationId,
      );

      if (emailInfo.length > 0) {
        context.info(
          `rejectOldServiceRequests: Sending rejection emails for the ${emailInfo.length} successfully rejected requests with active users`,
        );

        await sendRejectionEmails(emailInfo, notificationClient);
      }
    }

    context.info(
      `rejectOldServiceRequests: Finished processing overdue/no approver service requests older than ${targetDate.toLocaleDateString("en-GB")}`,
    );
  } catch (error) {
    throw new Error(`rejectOldServiceRequests: ${error.message}`);
  }
}
