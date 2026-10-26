import { Op } from "sequelize";
import {
  generateUsers,
  generateUserOrganisations,
  generateUserServices,
} from "../testUtils";
import { run } from "../../scripts/deleteNoSignalStaleAccounts";
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

describe("NSA-10119 deleteNoSignalStaleAccounts script", () => {
  const accessMock = jest.mocked(Access);
  const directoriesMock = jest.mocked(Directories);
  const organisationsMock = jest.mocked(Organisations);
  const batchRequestHelperMock = jest.mocked(batchRequestHelper);
  const createEntraClientMock = jest.mocked(createEntraGraphClient);
  const userMock = jest.mocked(User);
  const userPasswordPolicyMock = jest.mocked(UserPasswordPolicy);
  const userStatusChangeReasonMock = jest.mocked(UserStatusChangeReason);
  const userLegacyUsernameMock = jest.mocked(UserLegacyUsername);
  const userPasswordHistoryMock = jest.mocked(UserPasswordHistory);
  const passwordHistoryMock = jest.mocked(PasswordHistory);
  const invitationMock = jest.mocked(Invitation);
  const auditLoggerMock = jest.mocked(AuditLogger);

  const originalEnv = process.env;
  let infoSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DELETE_NO_SIGNAL_STALE_ACCOUNTS_DRY_RUN: "false",
    };

    infoSpy = jest.spyOn(console, "info").mockImplementation();
    errorSpy = jest.spyOn(console, "error").mockImplementation();

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

  it("it initialises the account deletion models with a connection to the directories DB", async () => {
    await run();

    expect(initialiseAccountDeletionModels).toHaveBeenCalledWith(
      connection(DatabaseName.Directories),
    );
  });

  it("it queries accounts with no reason row, no deactivated_at, excluded emails, and a stale/absent last_login, stalest-first", async () => {
    process.env.DELETE_NO_SIGNAL_STALE_ACCOUNTS_BATCH_SIZE = "750";

    await run();

    expect(userMock.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        raw: true,
        attributes: ["id", "email", "entraId"],
        where: {
          [Op.and]: [
            { status: 0 },
            { deactivatedAt: null },
            {
              email: {
                [Op.notIn]: expect.arrayContaining([
                  "deactivatedUser@iyvlbgpw.mailosaur.net",
                  "testdsisignin@n0n3fzi0.mailosaur.net",
                ]),
              },
            },
            {
              [Op.or]: [
                { lastLogin: { [Op.lt]: undefined } },
                { lastLogin: { [Op.is]: null } },
              ],
            },
            undefined,
          ],
        },
        order: [["lastLogin", "ASC"]],
        limit: 750,
      }),
    );
  });

  it("it defaults the batch size to 1000 when not configured", async () => {
    delete process.env.DELETE_NO_SIGNAL_STALE_ACCOUNTS_BATCH_SIZE;

    await run();

    expect(userMock.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1000 }),
    );
  });

  it("it logs the config values used for the run before querying", async () => {
    process.env.DELETE_NO_SIGNAL_STALE_ACCOUNTS_BATCH_SIZE = "500";

    await run();

    expect(infoSpy).toHaveBeenCalledWith(
      "deleteNoSignalStaleAccounts (NSA-10119): Starting run with dryRun=false, batchSize=500",
    );
  });

  describe("dry run mode", () => {
    beforeEach(() => {
      delete process.env.DELETE_NO_SIGNAL_STALE_ACCOUNTS_DRY_RUN;
    });

    it("it defaults to dry run when the flag is unset", async () => {
      userMock.findAll.mockResolvedValue(generateUsers(2, { status: 0 }));

      await run();

      expect(infoSpy).toHaveBeenCalledWith(
        "deleteNoSignalStaleAccounts (NSA-10119): Starting run with dryRun=true, batchSize=1000",
      );
      expect(infoSpy).toHaveBeenCalledWith(
        "deleteNoSignalStaleAccounts (NSA-10119): [DRY RUN] Completed - no accounts were deleted",
      );
    });

    it("it does not call any deletion APIs, Entra client, or DB destroy methods", async () => {
      userMock.findAll.mockResolvedValue(generateUsers(2, { status: 0 }));

      await run();

      expect(accessMock.prototype.getUserServices).not.toHaveBeenCalled();
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

    it("it sends an audit log entry per candidate and logs a spot-check sample", async () => {
      const users = generateUsers(2, { entraId: "entra-id" });
      userMock.findAll.mockResolvedValue(users);

      await run();

      expect(auditLoggerMock.prototype.batchedLog).toHaveBeenCalledWith(
        users.map((user) => ({
          message: `[DRY RUN] NSA-10119 manual batch would remove user ${user.email} (id: ${user.id.toUpperCase()})`,
          type: "support",
          subType: "account-deletion-dry-run",
          meta: {
            reason:
              "Automated task - Account deactivated for 12 months or more.",
            editedUser: user.id.toUpperCase(),
            hasEntraRecord: "true",
            source: "NSA-10119-manual-script",
          },
        })),
      );
      expect(infoSpy).toHaveBeenCalledWith(
        `deleteNoSignalStaleAccounts (NSA-10119): Would delete 2 accounts in this run. First 2 for spot-checking: ${users[0].email} (${users[0].id.toUpperCase()}), ${users[1].email} (${users[1].id.toUpperCase()})`,
      );
    });

    it("it does not send an audit log or spot-check sample if there are no candidates", async () => {
      userMock.findAll.mockResolvedValue([]);

      await run();

      expect(auditLoggerMock.prototype.batchedLog).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Would delete"),
      );
    });
  });

  describe("live mode", () => {
    it("it deletes API/organisation records, Entra records, and DB records for candidates, then sends an audit log", async () => {
      const users = generateUsers(2, { entraId: "entra-id" });
      userMock.findAll.mockResolvedValue(users);
      organisationsMock.prototype.getUserOrganisations.mockResolvedValue(
        generateUserOrganisations(1, "org-1"),
      );
      accessMock.prototype.getUserServices.mockResolvedValue(
        generateUserServices(1, users[0].id, "svc-1", "org-1"),
      );

      await run();

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
      expect(userMock.destroy).toHaveBeenCalledWith({
        where: { id: [users[0].id, users[1].id] },
      });
      expect(auditLoggerMock.prototype.batchedLog).toHaveBeenCalledWith(
        users.map((user) => ({
          message: `NSA-10119 manual batch deletion of deactivated user ${user.email} (id: ${user.id.toUpperCase()})`,
          type: "support",
          subType: "account-deleted",
          meta: {
            reason:
              "Automated task - Account deactivated for 12 months or more.",
            editedUser: user.id.toUpperCase(),
            source: "NSA-10119-manual-script",
          },
        })),
      );
      expect(infoSpy).toHaveBeenCalledWith(
        `deleteNoSignalStaleAccounts (NSA-10119): Deleted 2 accounts in this run. First 2 for spot-checking: ${users[0].email} (${users[0].id.toUpperCase()}), ${users[1].email} (${users[1].id.toUpperCase()})`,
      );
    });

    it("it skips Entra deletion for accounts with no entraId, and logs how many were skipped", async () => {
      const users = generateUsers(2, { entraId: null });
      userMock.findAll.mockResolvedValue(users);

      await run();

      expect(batchRequestHelperMock).not.toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledWith(
        "deleteNoSignalStaleAccounts (NSA-10119): Skipping Entra delete for 2 accounts due to missing entraId",
      );
    });

    it("it throws an error if an entire 100-row sub-batch of API record removals errored", async () => {
      userMock.findAll.mockResolvedValue(generateUsers(3));
      accessMock.prototype.getUserServices.mockRejectedValue(
        new Error("Testing"),
      );

      await expect(run()).rejects.toThrow(
        "Entire batch had an error, stopping without deleting DB/Entra records so it can be retried.",
      );
      expect(userMock.destroy).not.toHaveBeenCalled();
    });

    it("it logs unique errors and continues if only some of a sub-batch errored", async () => {
      const users = generateUsers(2);
      userMock.findAll.mockResolvedValue(users);
      directoriesMock.prototype.deleteUserCode
        .mockRejectedValueOnce(new Error("Testing"))
        .mockResolvedValue(true);

      await expect(run()).resolves.not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        "deleteNoSignalStaleAccounts (NSA-10119): Testing",
      );
      expect(userMock.destroy).toHaveBeenCalledWith({
        where: { id: [users[1].id] },
      });
    });

    it("it does not attempt DB deletion, audit logging, or spot-check sample if nothing succeeded", async () => {
      userMock.findAll.mockResolvedValue(generateUsers(1));
      directoriesMock.prototype.deleteUserCode.mockResolvedValue(false);

      await run();

      expect(userMock.destroy).not.toHaveBeenCalled();
      expect(auditLoggerMock.prototype.batchedLog).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Deleted"),
      );
    });

    it("it processes accounts in 100-row sub-batches", async () => {
      userMock.findAll.mockResolvedValue(generateUsers(150));

      await run();

      expect(infoSpy).toHaveBeenCalledWith(
        "deleteNoSignalStaleAccounts (NSA-10119): Removing API/association records for accounts 1 to 100",
      );
      expect(infoSpy).toHaveBeenCalledWith(
        "deleteNoSignalStaleAccounts (NSA-10119): Removing API/association records for accounts 101 to 150",
      );
    });
  });
});
