import { InvocationContext, Timer } from "@azure/functions";
import { Op, Sequelize } from "sequelize";
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
import { initialiseAccountDeletionModels } from "../infrastructure/database/common/utils";
import { User } from "../infrastructure/database/directories/User";
import { UserPasswordPolicy } from "../infrastructure/database/directories/UserPasswordPolicy";
import { UserStatusChangeReason } from "../infrastructure/database/directories/UserStatusChangeReason";
import { UserLegacyUsername } from "../infrastructure/database/directories/UserLegacyUsername";
import { UserPasswordHistory } from "../infrastructure/database/directories/UserPasswordHistory";
import { PasswordHistory } from "../infrastructure/database/directories/PasswordHistory";
import { Invitation } from "../infrastructure/database/directories/Invitation";
import { AuditLogger } from "../infrastructure/AuditLogger";
import { checkEnv } from "../infrastructure/utils";
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
 * The subset of a user's fields this function needs, plus whether the ship-date fallback (as
 * opposed to a real `user_status_change_reasons` row) was used to determine eligibility.
 */
type deletionCandidate = Pick<User, "id" | "email" | "entraId"> & {
  usedFallbackShipDate: boolean;
};

/**
 * Records returned for a user from our APIs.
 */
type userApiRecords = {
  services: userServiceRecord[];
  organisations: userOrganisationRecord[];
};

/**
 * The reason for deactivation.
 */
const DELETION_REASON =
  "Automated task - Account deactivated for 12 months or more.";

/**
 * The latest deactivation reason date for a user, or SQL NULL if they have no
 * `user_status_change_reasons` row (see NSA-9963/NSA-9964).
 */
const LATEST_REASON_DATE_EXPRESSION = `(
  SELECT MAX(r.createdAt) FROM user_status_change_reasons r WHERE r.user_id = [User].[sub] AND r.new_status = 0
)`;

/**
 * The eligibility date SQL expression: {@link LATEST_REASON_DATE_EXPRESSION}, falling back to
 * the feature's ship date (bound via the `:shipDate` replacement) for users with no reason row.
 */
const ELIGIBILITY_DATE_EXPRESSION = `COALESCE(${LATEST_REASON_DATE_EXPRESSION}, CAST(:shipDate AS DATETIME2))`;

/**
 * Whether the ship-date fallback (rather than a real reason row) determined a user's eligibility.
 */
const USED_FALLBACK_SHIP_DATE_EXPRESSION = `CASE WHEN ${LATEST_REASON_DATE_EXPRESSION} IS NULL THEN 1 ELSE 0 END`;

/**
 * Finds deactivated accounts eligible for permanent deletion: deactivated 12+ months ago,
 * using the latest `user_status_change_reasons` row where available, or the feature's ship
 * date as a fallback for accounts with no such row.
 *
 * @param batchCap - The maximum number of candidates to return in one run.
 * @param shipDate - The fallback eligibility date for accounts with no status-change reason.
 * @returns A promise containing the eligible {@link deletionCandidate} users, oldest-eligible-first.
 */
async function getEligibleUsers(
  batchCap: number,
  shipDate: string,
): Promise<deletionCandidate[]> {
  return (await User.findAll({
    attributes: [
      "id",
      "email",
      "entraId",
      [
        Sequelize.literal(USED_FALLBACK_SHIP_DATE_EXPRESSION),
        "usedFallbackShipDate",
      ],
    ],
    where: {
      [Op.and]: [
        { status: 0 },
        Sequelize.literal(
          `${ELIGIBILITY_DATE_EXPRESSION} < DATEADD(MONTH, -12, GETDATE())`,
        ),
      ],
    },
    order: [[Sequelize.literal(ELIGIBILITY_DATE_EXPRESSION), "ASC"]],
    limit: batchCap,
    replacements: { shipDate },
  })) as unknown as deletionCandidate[];
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
 * Deletes a user's organisation/service association and user code API records, so the
 * database records can be deleted.
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
        new Request(`https://graph.microsoft.com/v1.0/users/${id}`, {
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
 * Deletes a user's identity records from the directories database, in an order that respects
 * the `user_password_policy` and `user_status_change_reasons` foreign keys to `user`.
 *
 * `password_history` rows are only linked to a user indirectly via the `user_password_history`
 * join table, so its rows are looked up before the join rows are removed.
 *
 * @param userIds - IDs of users to delete database records for.
 */
async function deleteUserDbRecords(userIds: string[]): Promise<void> {
  const destroyByUserId = { where: { userId: userIds } };

  const passwordHistoryLinks: Pick<UserPasswordHistory, "passwordHistoryId">[] =
    await UserPasswordHistory.findAll({
      attributes: ["passwordHistoryId"],
      where: { userId: userIds },
    });

  await UserPasswordPolicy.destroy(destroyByUserId);
  await UserStatusChangeReason.destroy(destroyByUserId);
  await UserLegacyUsername.destroy(destroyByUserId);
  await UserPasswordHistory.destroy(destroyByUserId);

  if (passwordHistoryLinks.length > 0) {
    await PasswordHistory.destroy({
      where: {
        id: passwordHistoryLinks.map((link) => link.passwordHistoryId),
      },
    });
  }

  await Invitation.destroy(destroyByUserId);
  await User.destroy({
    where: {
      id: userIds,
    },
  });
}

/**
 * Permanently deletes accounts that have been deactivated for 12 months or more, from the
 * directories/organisations databases and Microsoft Entra ID.
 *
 * Runs in dry-run mode by default (`DRY_RUN_DELETE_DEACTIVATED_ACCOUNTS` unset or not "false"):
 * candidates are found and audit-logged, but nothing is deleted.
 *
 * @param timer - Azure function {@link Timer} implementing object.
 * @param context - Azure function {@link InvocationContext} to log and retrieve invocation data.
 *
 * @throws Error if any infrastructure connections fail, all user deletions fail in a batch, or
 * batched audit logging fails.
 */
export async function deleteDeactivatedAccounts(
  timer: Timer,
  context: InvocationContext,
): Promise<void> {
  if (timer.isPastDue) {
    context.warn(
      "deleteDeactivatedAccounts: Timer is marked as past due, and attempted to run the function",
    );
    return;
  }

  try {
    checkEnv(
      ["FEATURE_SHIP_DATE_DELETE_DEACTIVATED_ACCOUNTS"],
      "delete deactivated accounts",
    );

    const batchSize = 100;
    const batchCap =
      Number(process.env.DELETE_DEACTIVATED_ACCOUNTS_BATCH_CAP) || 2000;
    const dryRun =
      process.env.DRY_RUN_DELETE_DEACTIVATED_ACCOUNTS?.toLowerCase() !==
      "false";
    const shipDate = process.env.FEATURE_SHIP_DATE_DELETE_DEACTIVATED_ACCOUNTS;
    const correlationId = context.invocationId;

    const apis = {
      access: new Access(),
      directories: new Directories(),
      organisations: new Organisations(),
    };
    const auditLogger = new AuditLogger();
    const entraClient = createEntraGraphClient();

    initialiseAccountDeletionModels(connection(DatabaseName.Directories));

    context.info(
      `deleteDeactivatedAccounts: Starting run with dryRun=${dryRun}, batchCap=${batchCap}, shipDate=${shipDate}`,
    );

    const users = await getEligibleUsers(batchCap, shipDate);
    const fallbackCount = users.filter((user) =>
      Boolean(user.usedFallbackShipDate),
    ).length;

    context.info(
      `deleteDeactivatedAccounts: ${users.length} eligible users found (${users.length - fallbackCount} via user_status_change_reasons, ${fallbackCount} via ship-date fallback)`,
    );

    if (dryRun) {
      if (users.length > 0) {
        await auditLogger.batchedLog(
          users.map((user) => ({
            message: `[DRY RUN] Automated deletion would remove user ${user.email} (id: ${user.id.toUpperCase()}) from the directories database, organisation/service associations, and Entra ID`,
            type: "support",
            subType: "account-deletion-dry-run",
            meta: {
              reason: DELETION_REASON,
              editedUser: user.id.toUpperCase(),
              hasEntraRecord: String(
                typeof user.entraId === "string" &&
                  user.entraId.trim().length > 0,
              ),
              usedFallbackShipDate: String(Boolean(user.usedFallbackShipDate)),
            },
          })),
        );
      }
      context.info(
        "deleteDeactivatedAccounts: [DRY RUN] Completed - no accounts were deleted",
      );
      return;
    }

    for (let index = 0; index < users.length; index += batchSize) {
      const batch = users.slice(index, index + batchSize);
      const userRange = `${index + 1} to ${index + batch.length}`;
      context.info(
        `deleteDeactivatedAccounts: Removing API/association records for users ${userRange}`,
      );

      const { successful, failed, errored } = filterResults<deletionCandidate>(
        await Promise.allSettled(
          batch.map(async (user) => {
            const apiRecords = await getUserApiRecords(
              apis,
              user.id,
              correlationId,
            );
            return {
              ...(await deleteUserApiRecords(
                apis,
                user.id,
                apiRecords,
                correlationId,
              )),
              object: user,
            };
          }),
        ),
      );

      context.info(
        `deleteDeactivatedAccounts: ${successful.count} successful, ${failed.count} failed, and ${errored.count} errored API record removals for users ${userRange}`,
      );

      if (errored.count > 0) {
        errored.errors.forEach((error) =>
          context.error(`deleteDeactivatedAccounts: ${error}`),
        );
      }
      if (errored.count === batch.length) {
        throw new Error(
          "Entire batch had an error, failing execution so it can retry.",
        );
      }

      const usersWithEntraId = successful.objects.filter(
        (user): user is deletionCandidate & { entraId: string } =>
          typeof user.entraId === "string" && user.entraId.trim().length > 0,
      );
      const usersMissingEntraId = successful.objects.filter(
        (user) =>
          !(typeof user.entraId === "string" && user.entraId.trim().length > 0),
      );

      if (usersMissingEntraId.length > 0) {
        context.info(
          `deleteDeactivatedAccounts: Skipping Entra delete for ${usersMissingEntraId.length} users due to missing entraId`,
        );
      }

      if (usersWithEntraId.length > 0) {
        context.info(
          `deleteDeactivatedAccounts: Removing Entra records for ${usersWithEntraId.length} users in batch ${userRange}`,
        );
        await deleteUserEntraRecords(
          usersWithEntraId.map((user) => user.entraId.trim()),
          entraClient,
        );
      }

      if (successful.count > 0) {
        context.info(
          `deleteDeactivatedAccounts: Removing database records for the ${successful.count} users with successful API record removals`,
        );
        await deleteUserDbRecords(successful.objects.map((user) => user.id));

        context.info(
          `deleteDeactivatedAccounts: Sending audit messages for the ${successful.count} successful deletions`,
        );
        await auditLogger.batchedLog(
          successful.objects.map((user) => ({
            message: `Automated deletion of deactivated user ${user.email} (id: ${user.id.toUpperCase()})`,
            type: "support",
            subType: "account-deleted",
            meta: {
              reason: DELETION_REASON,
              editedUser: user.id.toUpperCase(),
            },
          })),
        );
      }
    }
  } catch (error) {
    throw new Error(`deleteDeactivatedAccounts: ${error.message}`);
  }
}
