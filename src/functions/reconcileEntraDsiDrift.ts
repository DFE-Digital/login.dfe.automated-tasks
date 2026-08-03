import { InvocationContext } from "@azure/functions";
import { Client } from "@microsoft/microsoft-graph-client";
import { Op, Sequelize } from "sequelize";
import { AuditLevel, type AuditLog } from "../infrastructure/AuditLogger";
import { User } from "../infrastructure/database/directories/User";

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
