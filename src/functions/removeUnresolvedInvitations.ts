import { InvocationContext, Timer } from "@azure/functions";
import { Op, Sequelize } from "sequelize";
import { Access, invitationServiceRecord } from "../infrastructure/api/dsiInternal/Access";
import { invitationOrganisationRecord, Organisations } from "../infrastructure/api/dsiInternal/Organisations";
import { connection, DatabaseName } from "../infrastructure/database/common/connection";
import { initialiseAllInvitationModels } from "../infrastructure/database/common/utils";
import { Invitation } from "../infrastructure/database/directories/Invitation";
import { InvitationCallback } from "../infrastructure/database/directories/InvitationCallback";

/**
 * Result of removing API records from an invitation.
 */
type apiRemovalResult = {
  id: string,
  apiRecordsRemoved: boolean,
};

/**
 * API clients used throughout this function.
 */
type apiClients = {
  access: Access,
  organisations: Organisations,
};

/**
 * Records returned for an invitation from our APIs.
 */
type invitationApiRecords = {
  services: invitationServiceRecord[],
  organisations: invitationOrganisationRecord[],
};

/**
 * Gets the invitation IDs from the database that match the requirements for unresolved deletions.
 *
 * @returns A promise containing the test invitation IDs.
 */
async function getInvitationIds(): Promise<string[]> {
  initialiseAllInvitationModels(connection(DatabaseName.Directories));

  return (await Invitation.findAll({
    attributes: ["id"],
    where: {
      [Op.and]: [
        {
          createdAt: {
            [Op.lt]: Sequelize.fn("DATEADD", Sequelize.literal("MONTH"), -3, Sequelize.fn("GETDATE"))
          }
        },
        { userId: null },
        { completed: false },
        { deactivated: false},
      ],
    },
  })).map((invitation) => invitation.id);
}

/**
 * Gets the API records for a specified invitation, so they can be used for deletions.
 *
 * @param apis - API clients to be used to get required invitation API records.
 * @param invitationId - Invitation ID to retrieve API records for.
 * @param correlationId - Correlation ID to be passed with API requests.
 * @returns A promise containing the API records for the requested invitation {@link invitationApiRecords}.
 */
async function getInvitationApiRecords(apis: apiClients, invitationId: string, correlationId: string): Promise<invitationApiRecords> {
  const [serviceRecordsResult, organisationRecordsResult] = await Promise.allSettled([
    apis.access.getInvitationServices(invitationId, correlationId),
    apis.organisations.getInvitationOrganisations(invitationId, correlationId),
  ]);

  const rejectedRecordsResults = [serviceRecordsResult, organisationRecordsResult]
    .filter((promise): promise is PromiseRejectedResult => promise.status === "rejected");
  if (rejectedRecordsResults.length > 0) {
    return Promise.reject([...new Set(rejectedRecordsResults.map((promise) => promise.reason.message))]);
  }

  return {
    services: (serviceRecordsResult as PromiseFulfilledResult<invitationServiceRecord[]>).value,
    organisations: (organisationRecordsResult as PromiseFulfilledResult<invitationOrganisationRecord[]>).value,
  }
};

/**
 * Deletes the API records for a specified invitation, so the database records can be deleted.
 *
 * @param apis - API clients to be used to delete invitation API records.
 * @param invitationId - Invitation ID to delete API records for.
 * @param apiRecords - Invitation API records to be deleted.
 * @param correlationId - Correlation ID to be passed with API requests.
 * @returns A promise containing the results of the API removals {@link apiRemovalResult}.
 */
async function deleteInvitationApiRecords(apis: apiClients, invitationId: string, apiRecords: invitationApiRecords, correlationId: string): Promise<apiRemovalResult> {
  const { services, organisations } = apiRecords;
  const servicesDeletedResults = await Promise.allSettled(services.map(async (record) =>
    apis.access.deleteInvitationService(invitationId, record.serviceId, record.organisationId, correlationId)
  ));
  const organisationsDeletedResults = await Promise.allSettled(organisations.map(async (record) =>
    apis.organisations.deleteInvitationOrganisation(invitationId, record.organisation.id, correlationId)
  ));

  const serviceErrors = servicesDeletedResults
    .filter((record): record is PromiseRejectedResult => record.status === "rejected")
    .map((record) => record.reason.message);
  const organisationErrors = organisationsDeletedResults
    .filter((record): record is PromiseRejectedResult => record.status === "rejected")
    .map((record) => record.reason.message);
  const errors = [...new Set(serviceErrors.concat(organisationErrors))];

  return (errors.length === 0) ? Promise.resolve({
    id: invitationId,
    apiRecordsRemoved: servicesDeletedResults.every((result) => result.status === "fulfilled" && result.value)
      && organisationsDeletedResults.every((result) => result.status === "fulfilled" && result.value),
  }) : Promise.reject(errors);
};

/**
 * Deletes database records for the requested invitations.
 *
 * @param invitationIds - IDs of invitations to delete database records for.
 */
async function deleteInvitationDbRecords(invitationIds: string[]): Promise<void> {
  await InvitationCallback.destroy({
    where: {
      invitationId: invitationIds,
    },
  });

  await Invitation.destroy({
    where: {
      id: invitationIds,
    },
  });
};

/**
 * Filters settled promise results into successful, failed, and errored states.
 *
 * @param results - Settled promise results, to be filtered into different statuses.
 * @returns An object containing the count/values for success/failed results, and the count/errors for errored results.
 */
function filterResults(results: PromiseSettledResult<apiRemovalResult>[]): {
  successful: {
    count: number,
    values: apiRemovalResult[],
  },
  failed: {
    count: number,
    values: apiRemovalResult[],
  },
  errored: {
    count: number,
    errors: string[],
  },
} {
  const successfulPromises = results.filter((result): result is PromiseFulfilledResult<apiRemovalResult> =>
    result.status === "fulfilled"
    && result.value.apiRecordsRemoved === true
  );
  const failedPromises = results.filter((result): result is PromiseFulfilledResult<apiRemovalResult> =>
    result.status === "fulfilled"
    && result.value.apiRecordsRemoved === false
  );
  const erroredPromises = results.filter((result): result is PromiseRejectedResult =>
    result.status === "rejected"
  );

  return {
    successful: {
      count: successfulPromises.length,
      values: successfulPromises.map((result) => result.value),
    },
    failed: {
      count: failedPromises.length,
      values: failedPromises.map((result) => result.value),
    },
    errored: {
      count: erroredPromises.length,
      errors: [...new Set(erroredPromises.flatMap((result) => result.reason as string[]))],
    },
  };
};

/**
 * Removes invitations that are active, incomplete and were created over 3 months ago.
 *
 * @param _ - Azure function {@link Timer} to handle scheduling information.
 * @param context - Azure function {@link InvocationContext} to log and retrieve invocation data.
 */
export async function removeUnresolvedInvitations(_: Timer, context: InvocationContext): Promise<void> {
  try {
    const correlationId = context.invocationId;
    const batchSize = 100;
    const apis = {
      access: new Access(),
      organisations: new Organisations(),
    };

    const invitationIds = await getInvitationIds();

    context.info(`removeUnresolvedInvitations: ${invitationIds.length} invitations found`);

    for (let index = 0; index < invitationIds.length; index += batchSize) {
      const batch = invitationIds.slice(index, index + batchSize);
      const invitationRange = `${index + 1} to ${index + batch.length}`;
      context.info(`removeUnresolvedInvitations: Removing invitations ${invitationRange}`);

      const { successful, failed, errored } = filterResults(await Promise.allSettled(batch.map(async (invitationId) => {
        const apiRecords = await getInvitationApiRecords(apis, invitationId, correlationId);
        return deleteInvitationApiRecords(apis, invitationId, apiRecords, correlationId);
      })));

      context.info(
        `removeUnresolvedInvitations: ${successful.count} successful, ${failed.count} failed, and ${errored.count} errored API record removals for invitations ${invitationRange}`
      );

      if (errored.count > 0) {
        errored.errors.forEach((error) => context.error(`removeUnresolvedInvitations: ${error}`));
      }
      if (errored.count === batch.length) {
        throw new Error("Entire batch had an error, failing execution so it can retry.");
      }

      if (successful.count > 0) {
        context.info(
          `removeUnresolvedInvitations: Removing database records for the ${successful.count} invitations with successful API record removals`
        );
        await deleteInvitationDbRecords(successful.values.map((value) => value.id));
      }
    }
  } catch (error) {
    throw new Error(`removeUnresolvedInvitations: ${error.message}`);
  }
};
