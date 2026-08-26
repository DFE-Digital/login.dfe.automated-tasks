import { InvocationContext, Timer } from "@azure/functions";
import { Op } from "sequelize";
import {
  generateUsers,
  generateUserOrganisations,
  generateUserServices,
} from "../testUtils";
import { deleteDeactivatedAccounts } from "../../src/functions/deleteDeactivatedAccounts";
import { Access } from "../../src/infrastructure/api/dsiInternal/Access";
import { Directories } from "../../src/infrastructure/api/dsiInternal/Directories";
import { Organisations } from "../../src/infrastructure/api/dsiInternal/Organisations";
import { batchRequestHelper } from "../../src/infrastructure/api/entraGraph/batchRequestHelper";
import { createEntraGraphClient } from "../../src/infrastructure/api/entraGraph/createEntraGraphClient";
import {
  connection,
  DatabaseName,
} from "../../src/infrastructure/database/common/connection";
import { initialiseAccountDeletionModels } from "../../src/infrastructure/database/common/utils";
import { User } from "../../src/infrastructure/database/directories/User";
import { UserPasswordPolicy } from "../../src/infrastructure/database/directories/UserPasswordPolicy";
import { UserStatusChangeReason } from "../../src/infrastructure/database/directories/UserStatusChangeReason";
import { UserLegacyUsername } from "../../src/infrastructure/database/directories/UserLegacyUsername";
import { UserPasswordHistory } from "../../src/infrastructure/database/directories/UserPasswordHistory";
import { PasswordHistory } from "../../src/infrastructure/database/directories/PasswordHistory";
import { Invitation } from "../../src/infrastructure/database/directories/Invitation";
import { AuditLogger } from "../../src/infrastructure/AuditLogger";

jest.mock("@azure/functions");
jest.mock("sequelize");
jest.mock("../../src/infrastructure/api/dsiInternal/Access");
jest.mock("../../src/infrastructure/api/dsiInternal/Directories");
jest.mock("../../src/infrastructure/api/dsiInternal/Organisations");
jest.mock("../../src/infrastructure/api/entraGraph/batchRequestHelper");
jest.mock("../../src/infrastructure/api/entraGraph/createEntraGraphClient");
jest.mock("../../src/infrastructure/database/common/connection");
jest.mock("../../src/infrastructure/database/common/utils");
jest.mock("../../src/infrastructure/database/directories/User");
jest.mock("../../src/infrastructure/database/directories/UserPasswordPolicy");
jest.mock(
  "../../src/infrastructure/database/directories/UserStatusChangeReason",
);
jest.mock("../../src/infrastructure/database/directories/UserLegacyUsername");
jest.mock("../../src/infrastructure/database/directories/UserPasswordHistory");
jest.mock("../../src/infrastructure/database/directories/PasswordHistory");
jest.mock("../../src/infrastructure/database/directories/Invitation");
jest.mock("../../src/infrastructure/AuditLogger");

describe("Delete deactivated accounts automated task", () => {
  const contextMock = jest.mocked(InvocationContext);
  const accessMock = jest.mocked(Access);
  const directoriesMock = jest.mocked(Directories);
  const organisationsMock = jest.mocked(Organisations);
  const batchRequestHelperMock = jest.mocked(batchRequestHelper);
  const createEntraClientMock = jest.mocked(createEntraGraphClient);
  const connectionMock = jest.mocked(connection);
  const userMock = jest.mocked(User);
  const userPasswordPolicyMock = jest.mocked(UserPasswordPolicy);
  const userStatusChangeReasonMock = jest.mocked(UserStatusChangeReason);
  const userLegacyUsernameMock = jest.mocked(UserLegacyUsername);
  const userPasswordHistoryMock = jest.mocked(UserPasswordHistory);
  const passwordHistoryMock = jest.mocked(PasswordHistory);
  const invitationMock = jest.mocked(Invitation);
  const auditLoggerMock = jest.mocked(AuditLogger);

  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      FEATURE_SHIP_DATE_DELETE_DEACTIVATED_ACCOUNTS: "2026-09-01",
      DRY_RUN_DELETE_DEACTIVATED_ACCOUNTS: "false",
    };

    userMock.findAll.mockResolvedValue([]);
    accessMock.prototype.getUserServices.mockResolvedValue([]);
    accessMock.prototype.deleteUserService.mockResolvedValue(true);
    directoriesMock.prototype.deleteUserCode.mockResolvedValue(true);
    organisationsMock.prototype.getUserOrganisations.mockResolvedValue([]);
    organisationsMock.prototype.deleteUserOrganisation.mockResolvedValue(true);
    batchRequestHelperMock.mockResolvedValue([]);
    createEntraClientMock.mockReturnValue(
      {} as ReturnType<typeof createEntraGraphClient>,
    );
    userPasswordHistoryMock.findAll.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("it logs a warning if the timer is marked as past due, without executing", async () => {
    await deleteDeactivatedAccounts(
      { isPastDue: true } as Timer,
      new InvocationContext(),
    );

    expect(contextMock.prototype.warn).toHaveBeenCalledWith(
      "deleteDeactivatedAccounts: Timer is marked as past due, and attempted to run the function",
    );
    expect(userMock.findAll).not.toHaveBeenCalled();
  });

  it("it throws an error if the feature ship date environment variable is missing", async () => {
    delete process.env.FEATURE_SHIP_DATE_DELETE_DEACTIVATED_ACCOUNTS;

    await expect(
      deleteDeactivatedAccounts({} as Timer, new InvocationContext()),
    ).rejects.toThrow(/deleteDeactivatedAccounts:/);
    expect(userMock.findAll).not.toHaveBeenCalled();
  });

  it("it throws an error if the Access API throws an error on instantiation", async () => {
    const errorMessage = "Test Error Access";
    accessMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(
      deleteDeactivatedAccounts({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`deleteDeactivatedAccounts: ${errorMessage}`);
  });

  it("it throws an error if the audit logger throws an error on instantiation", async () => {
    const errorMessage = "Test Error Audit";
    auditLoggerMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(
      deleteDeactivatedAccounts({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`deleteDeactivatedAccounts: ${errorMessage}`);
  });

  it("it throws an error if the database connection throws an error", async () => {
    const errorMessage = "Test Error DB Connection";
    connectionMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(
      deleteDeactivatedAccounts({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`deleteDeactivatedAccounts: ${errorMessage}`);
  });

  it("it initialises the account deletion models with a connection to the directories DB", async () => {
    await deleteDeactivatedAccounts({} as Timer, new InvocationContext());

    expect(initialiseAccountDeletionModels).toHaveBeenCalledWith(
      connection(DatabaseName.Directories),
    );
  });

  it("it queries eligible users with status 0, the eligibility expression, and the configured batch cap", async () => {
    process.env.DELETE_DEACTIVATED_ACCOUNTS_BATCH_CAP = "500";

    await deleteDeactivatedAccounts({} as Timer, new InvocationContext());

    expect(userMock.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        // Sequelize is auto-mocked, so Sequelize.literal(...) resolves to undefined here -
        // matches how deactivateUnusedAccounts.test.ts asserts nested Sequelize.fn calls.
        attributes: [
          "id",
          "email",
          "entraId",
          [undefined, "usedFallbackShipDate"],
        ],
        where: {
          [Op.and]: [{ status: 0 }, undefined],
        },
        limit: 500,
        replacements: { shipDate: "2026-09-01" },
      }),
    );
  });

  it("it logs the config values used for the run before querying", async () => {
    process.env.DELETE_DEACTIVATED_ACCOUNTS_BATCH_CAP = "500";

    await deleteDeactivatedAccounts({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      "deleteDeactivatedAccounts: Starting run with dryRun=false, batchCap=500, shipDate=2026-09-01",
    );
  });

  it("it logs a breakdown of how many candidates used a real status-change reason vs the ship-date fallback", async () => {
    const users = generateUsers(3, { status: 0 }).map((user, index) => ({
      ...user,
      usedFallbackShipDate: index < 2,
    }));
    userMock.findAll.mockResolvedValue(users as unknown as User[]);

    await deleteDeactivatedAccounts({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      "deleteDeactivatedAccounts: 3 eligible users found (1 via user_status_change_reasons, 2 via ship-date fallback)",
    );
  });

  it("it defaults the batch cap to 2000 when not configured", async () => {
    delete process.env.DELETE_DEACTIVATED_ACCOUNTS_BATCH_CAP;

    await deleteDeactivatedAccounts({} as Timer, new InvocationContext());

    expect(userMock.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 2000 }),
    );
  });

  describe("dry run mode", () => {
    beforeEach(() => {
      delete process.env.DRY_RUN_DELETE_DEACTIVATED_ACCOUNTS;
    });

    it("it defaults to dry run when the flag is unset", async () => {
      userMock.findAll.mockResolvedValue(generateUsers(3, { status: 0 }));
      await deleteDeactivatedAccounts({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalledWith(
        "deleteDeactivatedAccounts: Starting run with dryRun=true, batchCap=2000, shipDate=2026-09-01",
      );
      expect(contextMock.prototype.info).toHaveBeenCalledWith(
        "deleteDeactivatedAccounts: [DRY RUN] Completed - no accounts were deleted",
      );
    });

    it("it does not call any deletion APIs, Entra client, or DB destroy methods", async () => {
      userMock.findAll.mockResolvedValue(generateUsers(3, { status: 0 }));
      await deleteDeactivatedAccounts({} as Timer, new InvocationContext());

      expect(accessMock.prototype.getUserServices).not.toHaveBeenCalled();
      expect(accessMock.prototype.deleteUserService).not.toHaveBeenCalled();
      expect(directoriesMock.prototype.deleteUserCode).not.toHaveBeenCalled();
      expect(
        organisationsMock.prototype.deleteUserOrganisation,
      ).not.toHaveBeenCalled();
      expect(batchRequestHelperMock).not.toHaveBeenCalled();
      expect(userMock.destroy).not.toHaveBeenCalled();
      expect(userPasswordPolicyMock.destroy).not.toHaveBeenCalled();
      expect(userStatusChangeReasonMock.destroy).not.toHaveBeenCalled();
      expect(userLegacyUsernameMock.destroy).not.toHaveBeenCalled();
      expect(userPasswordHistoryMock.destroy).not.toHaveBeenCalled();
      expect(passwordHistoryMock.destroy).not.toHaveBeenCalled();
      expect(invitationMock.destroy).not.toHaveBeenCalled();
    });

    it("it sends an audit log entry per candidate describing what would be deleted", async () => {
      const users = generateUsers(2, {
        status: 0,
        entraId: "entra-id",
      }).map((user, index) => ({
        ...user,
        usedFallbackShipDate: index === 1,
      }));
      userMock.findAll.mockResolvedValue(users as unknown as User[]);
      await deleteDeactivatedAccounts({} as Timer, new InvocationContext());

      expect(auditLoggerMock.prototype.batchedLog).toHaveBeenCalledWith(
        users.map((user) => ({
          message: `[DRY RUN] Automated deletion would remove user ${user.email} (id: ${user.id.toUpperCase()}) from the directories database, organisation/service associations, and Entra ID`,
          type: "support",
          subType: "account-deletion-dry-run",
          meta: {
            reason:
              "Automated task - Account deactivated for 12 months or more.",
            editedUser: user.id.toUpperCase(),
            hasEntraRecord: "true",
            usedFallbackShipDate: String(user.usedFallbackShipDate),
          },
        })),
      );
    });

    it("it does not send an audit log if there are no eligible candidates", async () => {
      userMock.findAll.mockResolvedValue([]);
      await deleteDeactivatedAccounts({} as Timer, new InvocationContext());

      expect(auditLoggerMock.prototype.batchedLog).not.toHaveBeenCalled();
    });
  });

  describe("live mode", () => {
    it("it deletes API/organisation records, Entra records, and DB records for eligible users, then sends an audit log", async () => {
      const users = generateUsers(2, { status: 0, entraId: "entra-id" });
      userMock.findAll.mockResolvedValue(users);
      organisationsMock.prototype.getUserOrganisations.mockResolvedValue(
        generateUserOrganisations(1, "org-1"),
      );
      accessMock.prototype.getUserServices.mockResolvedValue(
        generateUserServices(1, users[0].id, "svc-1", "org-1"),
      );

      await deleteDeactivatedAccounts({} as Timer, new InvocationContext());

      expect(directoriesMock.prototype.deleteUserCode).toHaveBeenCalledTimes(2);
      expect(
        organisationsMock.prototype.deleteUserOrganisation,
      ).toHaveBeenCalled();
      expect(batchRequestHelperMock).toHaveBeenCalled();
      expect(userPasswordPolicyMock.destroy).toHaveBeenCalledWith({
        where: { userId: [users[0].id, users[1].id] },
      });
      expect(userStatusChangeReasonMock.destroy).toHaveBeenCalledWith({
        where: { userId: [users[0].id, users[1].id] },
      });
      expect(userLegacyUsernameMock.destroy).toHaveBeenCalledWith({
        where: { userId: [users[0].id, users[1].id] },
      });
      expect(userPasswordHistoryMock.destroy).toHaveBeenCalledWith({
        where: { userId: [users[0].id, users[1].id] },
      });
      expect(invitationMock.destroy).toHaveBeenCalledWith({
        where: { userId: [users[0].id, users[1].id] },
      });
      expect(userMock.destroy).toHaveBeenCalledWith({
        where: { id: [users[0].id, users[1].id] },
      });
      expect(auditLoggerMock.prototype.batchedLog).toHaveBeenCalledWith(
        users.map((user) => ({
          message: `Automated deletion of deactivated user ${user.email} (id: ${user.id.toUpperCase()})`,
          type: "support",
          subType: "account-deleted",
          meta: {
            reason:
              "Automated task - Account deactivated for 12 months or more.",
            editedUser: user.id.toUpperCase(),
          },
        })),
      );
    });

    it("it looks up orphaned password_history rows via the join table before deleting them", async () => {
      const users = generateUsers(1, { status: 0 });
      userMock.findAll.mockResolvedValue(users);
      userPasswordHistoryMock.findAll.mockResolvedValue([
        { passwordHistoryId: "ph-1" },
        { passwordHistoryId: "ph-2" },
      ] as UserPasswordHistory[]);

      await deleteDeactivatedAccounts({} as Timer, new InvocationContext());

      expect(userPasswordHistoryMock.findAll).toHaveBeenCalledWith({
        attributes: ["passwordHistoryId"],
        where: { userId: [users[0].id] },
      });
      expect(passwordHistoryMock.destroy).toHaveBeenCalledWith({
        where: { id: ["ph-1", "ph-2"] },
      });
    });

    it("it does not attempt to delete password_history rows if none are linked", async () => {
      userMock.findAll.mockResolvedValue(generateUsers(1, { status: 0 }));
      userPasswordHistoryMock.findAll.mockResolvedValue([]);

      await deleteDeactivatedAccounts({} as Timer, new InvocationContext());

      expect(passwordHistoryMock.destroy).not.toHaveBeenCalled();
    });

    it("it skips Entra deletion for users with no entraId, and logs how many were skipped", async () => {
      const users = generateUsers(2, { status: 0, entraId: null });
      userMock.findAll.mockResolvedValue(users);

      await deleteDeactivatedAccounts({} as Timer, new InvocationContext());

      expect(batchRequestHelperMock).not.toHaveBeenCalled();
      expect(contextMock.prototype.info).toHaveBeenCalledWith(
        "deleteDeactivatedAccounts: Skipping Entra delete for 2 users due to missing entraId",
      );
    });

    it("it throws an error if the entire batch of API record removals errored", async () => {
      userMock.findAll.mockResolvedValue(generateUsers(3, { status: 0 }));
      accessMock.prototype.getUserServices.mockRejectedValue(
        new Error("Testing"),
      );

      await expect(
        deleteDeactivatedAccounts({} as Timer, new InvocationContext()),
      ).rejects.toThrow(
        "deleteDeactivatedAccounts: Entire batch had an error, failing execution so it can retry.",
      );
      expect(userMock.destroy).not.toHaveBeenCalled();
    });

    it("it continues and logs errors if only some of the batch errored", async () => {
      const users = generateUsers(2, { status: 0 });
      userMock.findAll.mockResolvedValue(users);
      directoriesMock.prototype.deleteUserCode
        .mockRejectedValueOnce(new Error("Testing"))
        .mockResolvedValue(true);

      await expect(
        deleteDeactivatedAccounts({} as Timer, new InvocationContext()),
      ).resolves.not.toThrow();
      expect(userMock.destroy).toHaveBeenCalledWith({
        where: { id: [users[1].id] },
      });
    });

    it("it does not attempt DB deletion or audit logging if no users had successful API record removals", async () => {
      userMock.findAll.mockResolvedValue(generateUsers(1, { status: 0 }));
      directoriesMock.prototype.deleteUserCode.mockResolvedValue(false);
      accessMock.prototype.getUserServices.mockResolvedValue(
        generateUserServices(1),
      );
      accessMock.prototype.deleteUserService.mockResolvedValue(false);

      await deleteDeactivatedAccounts({} as Timer, new InvocationContext());

      expect(userMock.destroy).not.toHaveBeenCalled();
      expect(auditLoggerMock.prototype.batchedLog).not.toHaveBeenCalled();
    });
  });
});
