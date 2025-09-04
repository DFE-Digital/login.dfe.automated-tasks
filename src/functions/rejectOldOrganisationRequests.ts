import { InvocationContext, Timer } from "@azure/functions";
import { NotificationClient } from "login.dfe.jobs-client";
import { Directories } from "../infrastructure/api/dsiInternal/Directories";
import {
  organisationRequestRecord,
  Organisations,
} from "../infrastructure/api/dsiInternal/Organisations";
import { filterResults } from "./utils/filterResults";
import { checkEnv } from "../infrastructure/utils";
import { AuditLogger } from "../infrastructure/AuditLogger";

const targetDate = new Date();
targetDate.setMonth(targetDate.getMonth() - 3);

const rejectionReason =
  "Automated task - Approvers did not action request within 3 months";

type rejectionEmailInfo = {
  email: string;
  name: string;
  orgName: string;
  requestDate: Date;
};

/**
 * Rejects an organisation request.
 *
 * @param id - Request ID.
 * @param organisationsApi - {@link Organisations} API wrapper.
 * @param correlationId - Correlation ID to be passed with the request.
 * @returns true if the request was successfully rejected, false otherwise.
 */
async function rejectOrganisationRequest(
  id: string,
  organisationsApi: Organisations,
  correlationId: string,
) {
  return organisationsApi.updateOrganisationRequest(
    id,
    {
      status: -1,
      actioned_by: process.env.SUPPORT_USER_ID,
      actioned_at: Date.now(),
      actioned_reason: rejectionReason,
    },
    correlationId,
  );
}

/**
 * Sends rejection audit logs to allow support to see when a request is automatically rejected.
 *
 * @param requests - An array of {@link organisationRequestRecord} objects that need audit records to be written.
 * @param auditLogger - {@link AuditLogger} to send batches of logs for the requests.
 * @returns {Promise<void>}
 */
async function sendRejectionAuditLogs(
  requests: organisationRequestRecord[],
  auditLogger: AuditLogger,
): Promise<void> {
  return auditLogger.batchedLog(
    requests.map((request) => ({
      message: `Automated rejection of requests older than 3 months`,
      type: "approver",
      subType: "rejected-org",
      userId: process.env.SUPPORT_USER_ID,
      organisationid: request.org_id,
      meta: {
        editedUser: request.user_id,
        reason: rejectionReason,
      },
    })),
  );
}

/**
 * Sends rejection emails to the users using the standard organisation request templates.
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
    emailInfo.map(
      (info) =>
        notificationClient.sendAccessRequest(
          info.email,
          info.name,
          info.orgName,
          false,
          `The approver(s) at the organisation haven't taken any action on your request, which was made on ${info.requestDate.toLocaleDateString("en-GB")}.`,
        ) as Promise<void>,
    ),
  );
}

/**
 * Retrieves information to use in the rejected request email template, for any active users linked to requests.
 *
 * @param requests - An array of {@link organisationRequestRecord} objects that need emails to be sent.
 * @param directoriesApi - {@link Directories} API wrapper.
 * @param correlationId - Correlation ID to be passed with the request.
 * @returns An array of {@link rejectionEmailInfo} elements to use in the rejected request email template.
 */
async function getEmailInfo(
  requests: organisationRequestRecord[],
  directoriesApi: Directories,
  correlationId: string,
): Promise<rejectionEmailInfo[]> {
  const activeUsers = (
    await directoriesApi.getUsersByIds(
      [...new Set(requests.map((request) => request.user_id))],
      correlationId,
    )
  ).filter((user) => user.status === 1);
  return requests
    .map((request) => {
      const linkedUser = activeUsers.find(
        (user) => user.sub === request.user_id,
      );

      return linkedUser
        ? {
            email: linkedUser.email,
            name: `${linkedUser.given_name} ${linkedUser.family_name}`,
            orgName: request.org_name,
            requestDate: new Date(request.created_date),
          }
        : null;
    })
    .filter((info) => info !== null);
}

/**
 * Rejects organisation requests that are overdue or have no approvers, and were created over 3 months ago.
 *
 * @param _ - Azure function {@link Timer} to handle scheduling information.
 * @param context - Azure function {@link InvocationContext} to log and retrieve invocation data.
 */
export async function rejectOldOrganisationRequests(
  _: Timer,
  context: InvocationContext,
): Promise<void> {
  try {
    checkEnv(
      ["REDIS_CONNECTION_STRING", "SUPPORT_USER_ID"],
      "valid request rejections or Redis",
    );

    const correlationId = context.invocationId;
    const directories = new Directories();
    const organisations = new Organisations();
    const auditLogger = new AuditLogger();
    const notificationClient = new NotificationClient({
      connectionString: `${process.env.REDIS_CONNECTION_STRING}/4?tls=true`,
    });

    context.info(
      "rejectOldOrganisationRequests: Retrieving initial page of overdue/no approver organisation requests",
    );

    let requestPage = await organisations.getOrganisationRequestPage(
      1,
      correlationId,
      [2, 3],
    );

    while (requestPage.page <= requestPage.totalNumberOfPages) {
      const suitableRequests = requestPage.requests.filter(
        (request) => new Date(request.created_date) < targetDate,
      );

      if (suitableRequests.length === 0) {
        break;
      }

      context.info(
        `rejectOldOrganisationRequests: Rejecting ${suitableRequests.length} overdue/no approver organisation requests older than ${targetDate.toLocaleDateString("en-GB")}`,
      );

      const { successful, failed, errored } = filterResults(
        await Promise.allSettled(
          suitableRequests.map(async (request) => ({
            object: request,
            success: await rejectOrganisationRequest(
              request.id,
              organisations,
              correlationId,
            ),
          })),
        ),
      );

      context.info(
        `rejectOldOrganisationRequests: ${successful.count} successful, ${failed.count} failed, and ${errored.count} errored rejections for ${suitableRequests.length} organisation requests`,
      );

      if (errored.count > 0) {
        errored.errors.forEach((error) =>
          context.error(`rejectOldOrganisationRequests: ${error}`),
        );
      }
      if (errored.count === suitableRequests.length) {
        throw new Error(
          "All request rejections had an error, failing execution so it can retry.",
        );
      }

      if (successful.count > 0) {
        context.info(
          `rejectOldOrganisationRequests: Sending audit messages for the ${successful.count} successfully rejected requests`,
        );

        await sendRejectionAuditLogs(successful.objects, auditLogger);

        context.info(
          `rejectOldOrganisationRequests: Retrieving user information for the ${successful.count} successfully rejected requests`,
        );

        const emailInfo = await getEmailInfo(
          successful.objects,
          directories,
          correlationId,
        );
        if (emailInfo.length > 0) {
          context.info(
            `rejectOldOrganisationRequests: Sending rejection emails for the ${emailInfo.length} successfully rejected requests with active users`,
          );

          await sendRejectionEmails(emailInfo, notificationClient);
        }
      }

      context.info(
        "rejectOldOrganisationRequests: Retrieving additional page of overdue/no approver organisation requests",
      );

      // We retrieve page 1 repeatedly as the endpoint is sorted oldest first, so any requests updated above will no longer be returned.
      requestPage = await organisations.getOrganisationRequestPage(
        1,
        correlationId,
        [2, 3],
      );
    }

    context.info(
      `rejectOldOrganisationRequests: No more overdue/no approver organisation requests available older than ${targetDate.toLocaleDateString("en-GB")}`,
    );
  } catch (error) {
    throw new Error(`rejectOldOrganisationRequests: ${error.message}`);
  }
}
