import { InvocationContext, Timer } from "@azure/functions";
import { Op, Sequelize } from "sequelize";
import { deleteInvitationApiRecords, deleteInvitationDbRecords, getInvitationApiRecords } from "./services/invitations";
import { filterResults } from "./utils/filterResults";
import { Access } from "../infrastructure/api/dsiInternal/Access";
import { Organisations } from "../infrastructure/api/dsiInternal/Organisations";
import { connection, DatabaseName } from "../infrastructure/database/common/connection";
import { initialiseAllInvitationModels } from "../infrastructure/database/common/utils";
import { Invitation } from "../infrastructure/database/directories/Invitation";

/**
 * Gets the invitation IDs from the database that match the requirements for unresolved deletions.
 *
 * @returns A promise containing the unresolved invitation IDs to be removed.
 */
async function getUnresolvedInvitationIds(): Promise<string[]> {
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

    const invitationIds = await getUnresolvedInvitationIds();

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
        await deleteInvitationDbRecords(successful.objects);
      }
    }
  } catch (error) {
    throw new Error(`removeUnresolvedInvitations: ${error.message}`);
  }
};
