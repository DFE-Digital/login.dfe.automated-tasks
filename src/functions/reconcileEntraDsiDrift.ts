import { InvocationContext, Timer } from "@azure/functions";
import { Client } from "@microsoft/microsoft-graph-client";
import { Op, Sequelize } from "sequelize";
import {
  AuditLevel,
  AuditLogger,
  type AuditLog,
} from "../infrastructure/AuditLogger";
import { createEntraGraphClient } from "../infrastructure/api/entraGraph/createEntraGraphClient";
import {
  connection,
  DatabaseName,
} from "../infrastructure/database/common/connection";
import {
  User,
  initialiseUser,
} from "../infrastructure/database/directories/User";

/**
 * Escapes single quotes for safe use inside an OData filter string literal.
 *
 * @param value - The raw string value to escape.
 * @returns The escaped value, safe to interpolate into an OData filter expression.
 */
function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Finds DSI users flagged as internal that have sat unlinked from Entra past the given age
 * threshold, excluding accounts with a future entra_defer_until (deliberately deferred). For
 * each candidate, checks whether a matching Entra account actually exists by email — if so,
 * this is a genuine unlinked-account anomaly that should have self-healed on the user's next
 * Entra sign-in but hasn't.
 *
 * @param entraClient - Graph API client used to look up candidate emails in Entra.
 * @param context - Azure function {@link InvocationContext} used for logging.
 * @param minAgeDays - Minimum age in days since creation before a row is considered stuck.
 * @returns Audit log entries for each anomaly found.
 */
export async function findUnlinkedDsiUsers(
  entraClient: Client,
  context: InvocationContext,
  minAgeDays: number,
): Promise<AuditLog[]> {
  const candidates: Pick<User, "id" | "email" | "createdAt">[] =
    await User.findAll({
      attributes: ["id", "email", "createdAt"],
      where: {
        isInternalUser: true,
        isEntra: false,
        status: 1,
        createdAt: {
          [Op.lt]: Sequelize.fn(
            "DATEADD",
            Sequelize.literal("DAY"),
            -minAgeDays,
            Sequelize.fn("GETDATE"),
          ),
        },
        [Op.or]: [
          { entraDeferUntil: { [Op.is]: null } },
          { entraDeferUntil: { [Op.lte]: Sequelize.fn("GETDATE") } },
        ],
      },
    });

  context.info(
    `findUnlinkedDsiUsers: ${candidates.length} unlinked internal user candidate(s) found`,
  );

  const anomalies: AuditLog[] = [];

  for (const candidate of candidates) {
    try {
      const response = await entraClient
        .api("/users")
        .filter(`mail eq '${escapeODataString(candidate.email)}'`)
        .select("id,mail")
        .get();
      const matches: { id: string }[] = response.value;

      if (matches.length > 0) {
        anomalies.push({
          level: AuditLevel.Warning,
          message: `DSI user ${candidate.id} (${candidate.email}) has a matching Entra account but has not been linked since ${candidate.createdAt.toISOString()}`,
          type: "support",
          subType: "unlinked-entra-account",
          userId: candidate.id,
        });
      }
    } catch (error) {
      context.error(
        `findUnlinkedDsiUsers: Graph API lookup failed for ${candidate.id}: ${error.message}`,
      );
    }
  }

  context.info(
    `findUnlinkedDsiUsers: ${anomalies.length} unlinked anomaly/anomalies found`,
  );

  return anomalies;
}

type EntraUserRecord = { id: string; mail: string; createdDateTime: string };

/**
 * Finds Entra accounts created within the given lookback window that have no matching DSI
 * user by Entra object ID. This catches registration failures that didn't self-heal via a
 * subsequent sign-in (e.g. a permanent conflict such as a duplicate email).
 *
 * @param entraClient - Graph API client used to list recently created Entra users.
 * @param context - Azure function {@link InvocationContext} used for logging.
 * @param lookbackDays - How many days back to scan for newly created Entra users.
 * @returns Audit log entries for each anomaly found.
 */
export async function findOrphanedEntraUsers(
  entraClient: Client,
  context: InvocationContext,
  lookbackDays: number,
): Promise<AuditLog[]> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - lookbackDays);

  // Filtering /users on createdDateTime (and use of the `ge` operator) requires Microsoft
  // Graph's advanced query capabilities, which must be requested via the ConsistencyLevel
  // header and $count=true, otherwise the live Graph API rejects the request.
  let response: {
    value: EntraUserRecord[];
    "@odata.nextLink"?: string;
  } = await entraClient
    .api("/users")
    .header("ConsistencyLevel", "eventual")
    .count(true)
    .filter(`createdDateTime ge ${sinceDate.toISOString()}`)
    .select("id,mail,createdDateTime")
    .top(999)
    .get();

  const recentEntraUsers: EntraUserRecord[] = [];

  // Graph paginates at 100 results per page by default (999 requested above via .top(), which is
  // the maximum permitted per page) — follow @odata.nextLink until every page has been consumed,
  // otherwise a tenant with more than one page of matches would silently only be partially scanned.
  while (true) {
    recentEntraUsers.push(...(response.value ?? []));

    if (!response["@odata.nextLink"]) {
      break;
    }

    response = await entraClient
      .api(response["@odata.nextLink"])
      .header("ConsistencyLevel", "eventual")
      .get();
  }

  context.info(
    `findOrphanedEntraUsers: ${recentEntraUsers.length} recently created Entra user(s) found`,
  );

  if (recentEntraUsers.length === 0) {
    return [];
  }

  const dsiUsers: Pick<User, "entraId">[] = await User.findAll({
    attributes: ["entraId"],
    where: {
      entraId: recentEntraUsers.map((entraUser) => entraUser.id),
    },
  });
  const linkedEntraIds = new Set(dsiUsers.map((user) => user.entraId));

  const anomalies: AuditLog[] = recentEntraUsers
    .filter((entraUser) => !linkedEntraIds.has(entraUser.id))
    .map((entraUser) => ({
      level: AuditLevel.Warning,
      message: `Entra account ${entraUser.id} (${entraUser.mail}) created ${entraUser.createdDateTime} has no matching DSI user`,
      type: "support",
      subType: "orphaned-entra-account",
    }));

  context.info(
    `findOrphanedEntraUsers: ${anomalies.length} orphaned anomaly/anomalies found`,
  );

  return anomalies;
}

const UNLINKED_DSI_USER_MIN_AGE_DAYS = 14;
const ORPHANED_ENTRA_USER_LOOKBACK_DAYS = 7;

/**
 * Detects Entra/DSI account drift in both directions and reports anomalies via the audit log,
 * without making any automated changes. See NSA-9931.
 *
 * @param timer - Azure function {@link Timer} implementing object.
 * @param context - Azure function {@link InvocationContext} to log and retrieve invocation data.
 *
 * @throws Error if any infrastructure connections fail or the audit log fails to send.
 */
export async function reconcileEntraDsiDrift(
  timer: Timer,
  context: InvocationContext,
): Promise<void> {
  if (timer.isPastDue) {
    context.warn(
      "reconcileEntraDsiDrift: Timer is marked as past due, and attempted to run the function",
    );
    return;
  }

  const entraClient = createEntraGraphClient();
  const auditLogger = new AuditLogger();

  initialiseUser(connection(DatabaseName.Directories));

  const [unlinkedResult, orphanedResult] = await Promise.allSettled([
    findUnlinkedDsiUsers(entraClient, context, UNLINKED_DSI_USER_MIN_AGE_DAYS),
    findOrphanedEntraUsers(
      entraClient,
      context,
      ORPHANED_ENTRA_USER_LOOKBACK_DAYS,
    ),
  ]);

  // Use allSettled rather than all so a failure in one direction (e.g. a transient Graph API
  // error) doesn't discard anomalies that were successfully gathered from the other direction.
  if (unlinkedResult.status === "rejected") {
    context.error(
      `reconcileEntraDsiDrift: findUnlinkedDsiUsers failed: ${unlinkedResult.reason?.message ?? unlinkedResult.reason}`,
    );
  }
  if (orphanedResult.status === "rejected") {
    context.error(
      `reconcileEntraDsiDrift: findOrphanedEntraUsers failed: ${orphanedResult.reason?.message ?? orphanedResult.reason}`,
    );
  }

  const anomalies = [
    ...(unlinkedResult.status === "fulfilled" ? unlinkedResult.value : []),
    ...(orphanedResult.status === "fulfilled" ? orphanedResult.value : []),
  ];

  if (anomalies.length > 0) {
    context.warn(
      `reconcileEntraDsiDrift: ${anomalies.length} total anomaly/anomalies found`,
    );
    await auditLogger.batchedLog(anomalies);
  } else {
    context.info("reconcileEntraDsiDrift: 0 total anomalies found");
  }
}
