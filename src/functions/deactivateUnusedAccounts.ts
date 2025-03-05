import { InvocationContext, Timer } from "@azure/functions";
import { initialiseUser, User } from "../infrastructure/database/directories/User";
import { Op, Sequelize } from "sequelize";
import { Directories } from "../infrastructure/api/dsiInternal/Directories";
import { AuditLogger } from "../infrastructure/AuditLogger";
import { connection, DatabaseName } from "../infrastructure/database/common/connection";
import { filterResults } from "./utils/filterResults";

/**
 * Deactivates and generates audit logs for any users whose account has been inactive for over 2 years from the current date.
 *
 * @param _ - Azure function {@link Timer} implementing object.
 * @param context - Azure function {@link InvocationContext} to log and retrieve invocation data.
 *
 * @throws Error if any infrastructure connections fail, all user deactivations fail, or batched audit logging fails.
 */
export async function deactivateUnusedAccounts(_: Timer, context: InvocationContext): Promise<void> {
  try {
    const batchSize = 100;
    const directoriesApi = new Directories();
    const auditLogger = new AuditLogger();
    const targetDate = Sequelize.fn("DATEADD", Sequelize.literal("YEAR"), -2, Sequelize.fn("GETDATE"));

    initialiseUser(connection(DatabaseName.Directories));

    const users: Pick<User, "id" | "email">[] = await User.findAll({
      attributes: ["id", "email"],
      where: {
        [Op.and]: [
          { status: 1 },
          {
            [Op.or]: [
              { lastLogin: { [Op.lt]: targetDate } },
              {
                [Op.and]: [
                  { lastLogin: { [Op.is]: null } },
                  { createdAt: { [Op.lt]: targetDate } },
                ],
              },
            ],
          },
        ],
      },
    });

    context.info(`deactivateUnusedAccounts: ${users.length} users found`);

    for (let index = 0; index < users.length; index += batchSize) {
      const batch = users.slice(index, index + batchSize);
      const userRange = `${index + 1} to ${index + batch.length}`;
      context.info(`deactivateUnusedAccounts: Deactivating users ${userRange}`);

      const { successful, failed, errored } = filterResults<Pick<User, "id" | "email">>(
        await Promise.allSettled(batch.map(async (user) => ({
          object: user,
          success: await directoriesApi.deactivateUser(user.id, context.invocationId),
        })))
      );

      context.info(`deactivateUnusedAccounts: ${successful.count} successful, ${failed.count} failed, and ${errored.count} errored deactivations for users ${userRange}`);

      if (errored.count > 0) {
        errored.errors.forEach((error) => context.error(`deactivateUnusedAccounts: ${error}`));
      }
      if (errored.count === batch.length) {
        throw new Error("Entire batch had an error, failing execution so it can retry.");
      }

      if (successful.count > 0) {
        context.info(`deactivateUnusedAccounts: Sending audit messages for the ${successful.count} successful deactivations`);
        await auditLogger.batchedLog(successful.objects.map((user) => ({
          message: `Automated deactivation of user ${user.email} (id: ${user.id.toUpperCase()})`,
          type: "support",
          subType: "user-edit",
          meta: {
            reason: "Automated task - Deactivate accounts with 2 years of inactivity.",
            editedUser: user.id.toUpperCase(),
            editedFields: [{
              name: "status",
              oldValue: 1,
              newValue: 0,
            }],
          },
        })));
      }
    }
  } catch (error) {
    throw new Error(`deactivateUnusedAccounts: ${error.message}`);
  }
};
