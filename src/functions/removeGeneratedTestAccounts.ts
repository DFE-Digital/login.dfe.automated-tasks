import { InvocationContext, Timer } from "@azure/functions";
import { Op } from "sequelize";
import {
  deleteInvitationApiRecords,
  deleteInvitationDbRecords,
  getInvitationApiRecords,
} from "./services/invitations";
import { actionResult, filterResults } from "./utils/filterResults";
import {
  Access,
  type userServiceRecord,
} from "../infrastructure/api/dsiInternal/Access";
import { Directories } from "../infrastructure/api/dsiInternal/Directories";
import {
  Organisations,
  type userOrganisationRecord,
} from "../infrastructure/api/dsiInternal/Organisations";
import { batchRequestHelper } from "../infrastructure/api/entraGraph/batchRequestHelper";
import { createEntraGraphClient } from "../infrastructure/api/entraGraph/createEntraGraphClient";
import {
  connection,
  DatabaseName,
} from "../infrastructure/database/common/connection";
import {
  initialiseAllInvitationModels,
  initialiseAllUserModels,
} from "../infrastructure/database/common/utils";
import { Invitation } from "../infrastructure/database/directories/Invitation";
import { User } from "../infrastructure/database/directories/User";
import { UserPasswordPolicy } from "../infrastructure/database/directories/UserPasswordPolicy";
import { UserBanner } from "../infrastructure/database/organisations/UserBanner";
import { UserOrganisationRequest } from "../infrastructure/database/organisations/UserOrganisationRequest";
import { UserServiceRequest } from "../infrastructure/database/organisations/UserServiceRequest";
import { Client } from "@microsoft/microsoft-graph-client";

/**
 * API clients used throughout this function.
 */
type apiClients = {
  access: Access;
  directories: Directories;
  organisations: Organisations;
};

/**
 * Records returned for a user from our APIs.
 */
type userApiRecords = {
  services: userServiceRecord[];
  organisations: userOrganisationRecord[];
};

/**
 * Gets the user and invitation IDs from the database that match the generated test user structure.
 *
 * @returns A promise containing the test user and invitation IDs.
 */
async function getTestAccountIds(): Promise<{
  userIds: { dsi: string; entra: string | null }[];
  invitationIds: { dsi: string }[];
}> {
  const directoriesDb = connection(DatabaseName.Directories);

  initialiseAllUserModels(
    directoriesDb,
    connection(DatabaseName.Organisations),
  );
  initialiseAllInvitationModels(directoriesDb);

  const query = {
    attributes: ["id"],
    where: {
      [Op.and]: [
        { email: { [Op.like]: "%mailosaur%" } },
        {
          [Op.or]: [
            // AC exact matches
            { firstName: "CreateDSIAccount", lastName: "AutomationTest" },
            { firstName: "EntraCreateAccount", lastName: "AutomationTest" },
            { firstName: "Selenium", lastName: "Test" },
            { firstName: "SupportInviteUser", lastName: "AutomationTest" },
            { firstName: "Selenium_InviteUserTest", lastName: "Test" },

            // AC: LIKE patterns
            {
              firstName: { [Op.like]: "EntraInviteNewUser%" },
              lastName: { [Op.like]: "AutomationTest%" },
            },
            {
              firstName: { [Op.like]: "InviteNewUser%" },
              lastName: { [Op.like]: "AutomationTest%" },
            },

            // Remaining AC LIKE patterns
            {
              firstName: { [Op.like]: "SeleniumInviteUserTest%" },
              lastName: { [Op.like]: "Test%" },
            },
            {
              firstName: { [Op.like]: "CreateAccountErrors%" },
              lastName: { [Op.like]: "AutomationTest%" },
            },
          ],
        },
      ],
    },
  };

  const users: Pick<User, "id" | "entraId">[] = await User.findAll({
    ...query,
    attributes: [...query.attributes, "entraId"],
  });

  const invitations: Pick<Invitation, "id">[] = await Invitation.findAll(query);

  return {
    userIds: users.map((user) => ({
      dsi: user.id,
      entra: user.entraId,
    })),
    invitationIds: invitations.map((invitation) => ({ dsi: invitation.id })),
  };
}

/**
 * Gets the API records for a specified user, so they can be used for deletions.
 *
 * @param apis - API clients to be used to get required user API records.
 * @param userId - User ID to retrieve API records for.
 * @param correlationId - Correlation ID to be passed with API requests.
 * @returns A promise containing the API records for the requested user {@link userApiRecords}.
 */
async function getUserApiRecords(
  apis: apiClients,
  userId: string,
  correlationId: string,
): Promise<userApiRecords> {
  const [serviceRecordsResult, organisationRecordsResult] =
    await Promise.allSettled([
      apis.access.getUserServices(userId, correlationId),
      apis.organisations.getUserOrganisations(userId, correlationId),
    ]);

  const rejectedRecordsResults = [
    serviceRecordsResult,
    organisationRecordsResult,
  ].filter(
    (promise): promise is PromiseRejectedResult =>
      promise.status === "rejected",
  );

  if (rejectedRecordsResults.length > 0) {
    return Promise.reject(
      rejectedRecordsResults.map((promise) => promise.reason),
    );
  }

  return {
    services: (
      serviceRecordsResult as PromiseFulfilledResult<userServiceRecord[]>
    ).value,
    organisations: (
      organisationRecordsResult as PromiseFulfilledResult<
        userOrganisationRecord[]
      >
    ).value,
  };
}

/**
 * Deletes the API records for a specified user, so the database records can be deleted.
 *
 * @param apis - API clients to be used to delete user API records.
 * @param userId - User ID to delete API records for.
 * @param apiRecords - User API records to be deleted.
 * @param correlationId - Correlation ID to be passed with API requests.
 * @returns A promise containing the results of the API removals {@link actionResult}.
 */
async function deleteUserApiRecords(
  apis: apiClients,
  userId: string,
  apiRecords: userApiRecords,
  correlationId: string,
): Promise<actionResult<string>> {
  const { services, organisations } = apiRecords;
  const errors: string[] = [];

  let deleteUserCodeResult = false;
  try {
    deleteUserCodeResult = await apis.directories.deleteUserCode(
      userId,
      correlationId,
    );
  } catch (error) {
    errors.push(error);
  }

  const servicesDeletedResults = await Promise.allSettled(
    services.map(async (record) =>
      apis.access.deleteUserService(
        userId,
        record.serviceId,
        record.organisationId,
        correlationId,
      ),
    ),
  );
  const organisationsDeletedResults = await Promise.allSettled(
    organisations.map(async (record) =>
      apis.organisations.deleteUserOrganisation(
        userId,
        record.organisation.id,
        correlationId,
      ),
    ),
  );

  const serviceErrors = servicesDeletedResults
    .filter(
      (record): record is PromiseRejectedResult => record.status === "rejected",
    )
    .map((record) => record.reason);
  const organisationErrors = organisationsDeletedResults
    .filter(
      (record): record is PromiseRejectedResult => record.status === "rejected",
    )
    .map((record) => record.reason);
  errors.push(...serviceErrors.concat(organisationErrors));

  return errors.length === 0
    ? Promise.resolve({
        object: userId,
        success:
          deleteUserCodeResult === true &&
          servicesDeletedResults.every(
            (result) => result.status === "fulfilled" && result.value,
          ) &&
          organisationsDeletedResults.every(
            (result) => result.status === "fulfilled" && result.value,
          ),
      })
    : Promise.reject(errors);
}

/**
 * Deletes Entra records for the requested users.
 *
 * 404 responses are not counted as failures due to the Entra record no longer existing.
 *
 * @param userEntraIds - IDs of users to delete Entra records for.
 * @param entraClient - An Entra API client to request user deletions with.
 *
 * @throws Error if any Graph API responses are not successful or 404 failures.
 */
async function deleteUserEntraRecords(
  userEntraIds: string[],
  entraClient: Client,
): Promise<void> {
  const results = await batchRequestHelper(
    userEntraIds.map(
      (id) =>
        new Request(`/v1.0/users/${id}`, {
          method: "DELETE",
        }),
    ),
    entraClient,
  );
  const failedResponseErrors = results
    .filter((response) => !response.success && response.status !== 404)
    .map(
      (response) =>
        `${response.status} - ${response.errorCode} - ${response.errorMessage}`,
    );

  if (failedResponseErrors.length > 0) {
    throw new Error(
      "Graph API failures: " + [...new Set(failedResponseErrors)].join(", "),
    );
  }
}

/**
 * Deletes database records for the requested users.
 *
 * @param userIds - IDs of users to delete database records for.
 */
async function deleteUserDbRecords(userIds: string[]): Promise<void> {
  const destroyQuery = {
    where: {
      userId: userIds,
    },
  };
  await UserBanner.destroy(destroyQuery);
  await UserOrganisationRequest.destroy(destroyQuery);
  await UserServiceRequest.destroy(destroyQuery);
  await UserPasswordPolicy.destroy(destroyQuery);
  await User.destroy({
    where: {
      id: userIds,
    },
  });
}

/**
 * Removes generated test users/invitations based on their email address domain and names.
 *
 * @param timer - Azure function {@link Timer} to handle scheduling information.
 * @param context - Azure function {@link InvocationContext} to log and retrieve invocation data.
 */
export async function removeGeneratedTestAccounts(
  timer: Timer,
  context: InvocationContext,
): Promise<void> {
  if (timer.isPastDue) {
    context.warn(
      "removeGeneratedTestAccounts: Timer is marked as past due, and attempted to run the function",
    );
    return;
  }

  try {
    const correlationId = context.invocationId;
    const batchSize = 100;
    const apis = {
      access: new Access(),
      directories: new Directories(),
      organisations: new Organisations(),
    };
    const entraClient = createEntraGraphClient();

    const { userIds, invitationIds } = await getTestAccountIds();
    context.info(
      `removeGeneratedTestAccounts: ${userIds.length} users and ${invitationIds.length} invitations found`,
    );

    for (let index = 0; index < userIds.length; index += batchSize) {
      const batch = userIds.slice(index, index + batchSize);
      const userRange = `${index + 1} to ${index + batch.length}`;
      context.info(`removeGeneratedTestAccounts: Removing users ${userRange}`);

      const { successful, failed, errored } = filterResults(
        await Promise.allSettled(
          batch.map(async (ids) => {
            const apiRecords = await getUserApiRecords(
              apis,
              ids.dsi,
              correlationId,
            );
            return {
              ...(await deleteUserApiRecords(
                apis,
                ids.dsi,
                apiRecords,
                correlationId,
              )),
              object: ids,
            };
          }),
        ),
      );

      context.info(
        `removeGeneratedTestAccounts: ${successful.count} successful, ${failed.count} failed, and ${errored.count} errored API record removals for users ${userRange}`,
      );

      if (errored.count > 0) {
        errored.errors.forEach((error) =>
          context.error(`removeGeneratedTestAccounts: ${error}`),
        );
      }
      if (errored.count === batch.length) {
        throw new Error(
          "Entire batch had an error, failing execution so it can retry.",
        );
      }

      if (successful.count > 0) {
        context.info(
          `removeGeneratedTestAccounts: Removing Entra and database records for the ${successful.count} users with successful API record removals`,
        );
        await deleteUserEntraRecords(
          successful.objects
            .filter((ids) => ids.entra !== null)
            .map((ids) => ids.entra),
          entraClient,
        );
        await deleteUserDbRecords(successful.objects.map((ids) => ids.dsi));
      }
    }

    for (let index = 0; index < invitationIds.length; index += batchSize) {
      const batch = invitationIds.slice(index, index + batchSize);
      const invitationRange = `${index + 1} to ${index + batch.length}`;
      context.info(
        `removeGeneratedTestAccounts: Removing invitations ${invitationRange}`,
      );

      const { successful, failed, errored } = filterResults(
        await Promise.allSettled(
          batch.map(async ({ dsi }) => {
            const apiRecords = await getInvitationApiRecords(
              apis,
              dsi,
              correlationId,
            );
            return deleteInvitationApiRecords(
              apis,
              dsi,
              apiRecords,
              correlationId,
            );
          }),
        ),
      );

      context.info(
        `removeGeneratedTestAccounts: ${successful.count} successful, ${failed.count} failed, and ${errored.count} errored API record removals for invitations ${invitationRange}`,
      );

      if (errored.count > 0) {
        errored.errors.forEach((error) =>
          context.error(`removeGeneratedTestAccounts: ${error}`),
        );
      }
      if (errored.count === batch.length) {
        throw new Error(
          "Entire batch had an error, failing execution so it can retry.",
        );
      }

      if (successful.count > 0) {
        context.info(
          `removeGeneratedTestAccounts: Removing database records for the ${successful.count} invitations with successful API record removals`,
        );
        await deleteInvitationDbRecords(successful.objects);
      }
    }
  } catch (error) {
    throw new Error(`removeGeneratedTestAccounts: ${error.message}`);
  }
}
