import { Op, Sequelize } from "sequelize";
import { Access } from "../src/infrastructure/api/dsiInternal/Access";
import { Directories } from "../src/infrastructure/api/dsiInternal/Directories";
import { Organisations } from "../src/infrastructure/api/dsiInternal/Organisations";
import { createEntraGraphClient } from "../src/infrastructure/api/entraGraph/createEntraGraphClient";
import {
  connection,
  DatabaseName,
} from "../src/infrastructure/database/common/connection";
import { initialiseAccountDeletionModels } from "../src/infrastructure/database/common/utils";
import { User } from "../src/infrastructure/database/directories/User";
import { AuditLogger } from "../src/infrastructure/AuditLogger";
import { filterResults } from "../src/functions/utils/filterResults";
import {
  DELETION_REASON,
  EXCLUDED_TEST_ACCOUNT_EMAILS,
  getUserApiRecords,
  deleteUserApiRecords,
  deleteUserEntraRecords,
  deleteUserDbRecords,
  logAccountSample,
  type apiClients,
} from "../src/functions/deleteDeactivatedAccounts";

const LOG_PREFIX = "deleteNoSignalStaleAccounts (NSA-10119)";

/**
 * The subset of a user's fields this script needs.
 */
type candidate = Pick<User, "id" | "email" | "entraId">;

/**
 * Finds deactivated accounts with no `user_status_change_reasons` row and no `deactivated_at`
 * value - i.e. no reliable historical deactivation signal at all - whose `last_login` is older
 * than 3 months, or who have never logged in. This is the specific cohort NSA-10119 covers: per
 * Jane's decision on NSA-9963, this cohort is low-risk to delete now, ahead of the rest of the
 * ~157k backlog's normal rollout through the monthly `deleteDeactivatedAccounts` job.
 *
 * Deliberately narrower than that job's own eligibility query - this excludes accounts with a
 * `user_status_change_reasons` row or a `deactivated_at` value (even an old one), so this script
 * never touches accounts the monthly job already handles under the standard 12-month rule.
 *
 * @param batchSize - The maximum number of candidates to return in one run.
 * @returns A promise containing the matching {@link candidate} accounts, stalest-login-first.
 */
async function getNoSignalStaleAccounts(
  batchSize: number,
): Promise<candidate[]> {
  return (await User.findAll({
    raw: true,
    attributes: ["id", "email", "entraId"],
    where: {
      [Op.and]: [
        { status: 0 },
        { deactivatedAt: null },
        { email: { [Op.notIn]: EXCLUDED_TEST_ACCOUNT_EMAILS } },
        {
          [Op.or]: [
            {
              lastLogin: {
                [Op.lt]: Sequelize.literal("DATEADD(MONTH, -3, GETDATE())"),
              },
            },
            { lastLogin: { [Op.is]: null } },
          ],
        },
        Sequelize.literal(
          "NOT EXISTS (SELECT 1 FROM user_status_change_reasons r WHERE r.user_id = [User].[sub] AND r.new_status = 0)",
        ),
      ],
    },
    order: [["lastLogin", "ASC"]],
    limit: batchSize,
  })) as unknown as candidate[];
}

/**
 * Manually-run script for NSA-10119: deletes deactivated accounts with no reliable historical
 * deactivation signal and a `last_login` 3+ months old (or none at all), one capped batch per
 * invocation - run it again for the next batch. Deliberately not wired up as a scheduled Azure
 * Function: this is a plain script an engineer runs on demand, so batches can be spaced out to
 * watch for a support ticket spike between runs, per Jane's decision on NSA-9963.
 *
 * Runs in dry-run mode by default (`DELETE_NO_SIGNAL_STALE_ACCOUNTS_DRY_RUN` unset or not "false"):
 * candidates are found and audit-logged, but nothing is deleted.
 *
 * Reuses the same deletion mechanics (API associations, Entra ID, directories DB records) as the
 * monthly `deleteDeactivatedAccounts` function, just against this narrower candidate list.
 *
 * @throws Error if every account in a 100-row sub-batch errors at the API-record-removal step.
 */
export async function run(): Promise<void> {
  const subBatchSize = 100;
  const batchSize =
    Number(process.env.DELETE_NO_SIGNAL_STALE_ACCOUNTS_BATCH_SIZE) || 1000;
  const dryRun =
    process.env.DELETE_NO_SIGNAL_STALE_ACCOUNTS_DRY_RUN?.toLowerCase() !==
    "false";
  const correlationId = `nsa-10119-manual-${Date.now()}`;

  const apis: apiClients = {
    access: new Access(),
    directories: new Directories(),
    organisations: new Organisations(),
  };
  const auditLogger = new AuditLogger();
  const entraClient = createEntraGraphClient();

  initialiseAccountDeletionModels(connection(DatabaseName.Directories));

  console.info(
    `${LOG_PREFIX}: Starting run with dryRun=${dryRun}, batchSize=${batchSize}`,
  );

  const candidates = await getNoSignalStaleAccounts(batchSize);

  console.info(
    `${LOG_PREFIX}: ${candidates.length} accounts found (no user_status_change_reasons row, no deactivated_at, last_login 3+ months old or never logged in)`,
  );

  if (dryRun) {
    if (candidates.length > 0) {
      await auditLogger.batchedLog(
        candidates.map((user) => ({
          message: `[DRY RUN] NSA-10119 manual batch would remove user ${user.email} (id: ${user.id.toUpperCase()})`,
          type: "support",
          subType: "account-deletion-dry-run",
          meta: {
            reason: DELETION_REASON,
            editedUser: user.id.toUpperCase(),
            hasEntraRecord: String(
              typeof user.entraId === "string" &&
                user.entraId.trim().length > 0,
            ),
            source: "NSA-10119-manual-script",
          },
        })),
      );
    }
    console.info(
      `${LOG_PREFIX}: [DRY RUN] Completed - no accounts were deleted`,
    );
    logAccountSample(console, LOG_PREFIX, "Would delete", candidates);
    return;
  }

  const deletedAccounts: { id: string; email: string }[] = [];

  for (let index = 0; index < candidates.length; index += subBatchSize) {
    const batch = candidates.slice(index, index + subBatchSize);
    const batchRange = `${index + 1} to ${index + batch.length}`;
    console.info(
      `${LOG_PREFIX}: Removing API/association records for accounts ${batchRange}`,
    );

    const { successful, failed, errored } = filterResults<candidate>(
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

    console.info(
      `${LOG_PREFIX}: ${successful.count} successful, ${failed.count} failed, and ${errored.count} errored API record removals for accounts ${batchRange}`,
    );

    if (errored.count > 0) {
      errored.errors.forEach((error) =>
        console.error(`${LOG_PREFIX}: ${error}`),
      );
    }
    if (errored.count === batch.length) {
      throw new Error(
        "Entire batch had an error, stopping without deleting DB/Entra records so it can be retried.",
      );
    }

    const usersWithEntraId = successful.objects.filter(
      (user): user is candidate & { entraId: string } =>
        typeof user.entraId === "string" && user.entraId.trim().length > 0,
    );
    const usersMissingEntraId = successful.objects.filter(
      (user) =>
        !(typeof user.entraId === "string" && user.entraId.trim().length > 0),
    );

    if (usersMissingEntraId.length > 0) {
      console.info(
        `${LOG_PREFIX}: Skipping Entra delete for ${usersMissingEntraId.length} accounts due to missing entraId`,
      );
    }

    if (usersWithEntraId.length > 0) {
      console.info(
        `${LOG_PREFIX}: Removing Entra records for ${usersWithEntraId.length} accounts in batch ${batchRange}`,
      );
      await deleteUserEntraRecords(
        usersWithEntraId.map((user) => user.entraId.trim()),
        entraClient,
      );
    }

    if (successful.count > 0) {
      console.info(
        `${LOG_PREFIX}: Removing database records for the ${successful.count} accounts with successful API record removals`,
      );
      await deleteUserDbRecords(successful.objects.map((user) => user.id));

      console.info(
        `${LOG_PREFIX}: Sending audit messages for the ${successful.count} successful deletions`,
      );
      await auditLogger.batchedLog(
        successful.objects.map((user) => ({
          message: `NSA-10119 manual batch deletion of deactivated user ${user.email} (id: ${user.id.toUpperCase()})`,
          type: "support",
          subType: "account-deleted",
          meta: {
            reason: DELETION_REASON,
            editedUser: user.id.toUpperCase(),
            source: "NSA-10119-manual-script",
          },
        })),
      );

      deletedAccounts.push(
        ...successful.objects.map((user) => ({
          id: user.id,
          email: user.email,
        })),
      );
    }
  }

  logAccountSample(console, LOG_PREFIX, "Deleted", deletedAccounts);
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`${LOG_PREFIX}: Fatal error - ${error.message}`);
      process.exit(1);
    });
}
