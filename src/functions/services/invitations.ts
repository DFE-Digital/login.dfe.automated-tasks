import {
  Access,
  type invitationServiceRecord,
} from "../../infrastructure/api/dsiInternal/Access";
import {
  type invitationOrganisationRecord,
  Organisations,
} from "../../infrastructure/api/dsiInternal/Organisations";
import { Invitation } from "../../infrastructure/database/directories/Invitation";
import { InvitationCallback } from "../../infrastructure/database/directories/InvitationCallback";
import { type actionResult } from "../utils/filterResults";

/**
 * API clients used throughout this function.
 */
type apiClients = {
  access: Access;
  organisations: Organisations;
};

/**
 * Records returned for an invitation from our APIs.
 */
type invitationApiRecords = {
  services: invitationServiceRecord[];
  organisations: invitationOrganisationRecord[];
};

/**
 * Gets the API records for a specified invitation, so they can be used for other actions.
 *
 * @param apis - API clients to be used to get required invitation API records.
 * @param invitationId - Invitation ID to retrieve API records for.
 * @param correlationId - Correlation ID to be passed with API requests.
 * @returns A promise containing the API records for the requested invitation {@link invitationApiRecords}.
 */
export async function getInvitationApiRecords(
  apis: apiClients,
  invitationId: string,
  correlationId: string,
): Promise<invitationApiRecords> {
  const [serviceRecordsResult, organisationRecordsResult] =
    await Promise.allSettled([
      apis.access.getInvitationServices(invitationId, correlationId),
      apis.organisations.getInvitationOrganisations(
        invitationId,
        correlationId,
      ),
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
      serviceRecordsResult as PromiseFulfilledResult<invitationServiceRecord[]>
    ).value,
    organisations: (
      organisationRecordsResult as PromiseFulfilledResult<
        invitationOrganisationRecord[]
      >
    ).value,
  };
}

/**
 * Deletes the API records for a specified invitation, so the remaining database records can be deleted.
 *
 * @param apis - API clients to be used to delete invitation API records.
 * @param invitationId - Invitation ID to delete API records for.
 * @param apiRecords - Invitation API records to be deleted.
 * @param correlationId - Correlation ID to be passed with API requests.
 * @returns A promise containing the results of the API removals {@link actionResult}.
 */
export async function deleteInvitationApiRecords(
  apis: apiClients,
  invitationId: string,
  apiRecords: invitationApiRecords,
  correlationId: string,
): Promise<actionResult<string>> {
  const { services, organisations } = apiRecords;
  const servicesDeletedResults = await Promise.allSettled(
    services.map(async (record) =>
      apis.access.deleteInvitationService(
        invitationId,
        record.serviceId,
        record.organisationId,
        correlationId,
      ),
    ),
  );
  const organisationsDeletedResults = await Promise.allSettled(
    organisations.map(async (record) =>
      apis.organisations.deleteInvitationOrganisation(
        invitationId,
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
  const errors = serviceErrors.concat(organisationErrors);

  return errors.length === 0
    ? {
        object: invitationId,
        success:
          servicesDeletedResults.every(
            (result) => result.status === "fulfilled" && result.value,
          ) &&
          organisationsDeletedResults.every(
            (result) => result.status === "fulfilled" && result.value,
          ),
      }
    : Promise.reject(errors);
}

/**
 * Deletes database records for the requested invitations that cannot be removed through the API.
 *
 * @param invitationIds - IDs of invitations to delete database records for.
 */
export async function deleteInvitationDbRecords(
  invitationIds: string[],
): Promise<void> {
  try {
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
  } catch (error) {
    return Promise.reject(new Error(error.message));
  }
}
