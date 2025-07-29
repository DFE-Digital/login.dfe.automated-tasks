import { InvocationContext, Timer } from "@azure/functions";
import { Op, Sequelize } from "sequelize";
import { Directories } from "../../src/infrastructure/api/dsiInternal/Directories";
import { AuditLogger } from "../../src/infrastructure/AuditLogger";
import {
  initialiseUser,
  User,
} from "../../src/infrastructure/database/directories/User";
import { deactivateUnusedAccounts } from "../../src/functions/deactivateUnusedAccounts";
import {
  connection,
  DatabaseName,
} from "../../src/infrastructure/database/common/connection";
import { generateUsers } from "../testUtils";

jest.mock("@azure/functions");
jest.mock("sequelize");
jest.mock("../../src/infrastructure/database/common/connection");
jest.mock("../../src/infrastructure/database/directories/User");
jest.mock("../../src/infrastructure/api/dsiInternal/Directories");
jest.mock("../../src/infrastructure/AuditLogger");

describe("Deactivate unused accounts automated task", () => {
  const contextMock = jest.mocked(InvocationContext);
  const directoriesMock = jest.mocked(Directories);
  const auditLoggerMock = jest.mocked(AuditLogger);
  const userMock = jest.mocked(User);

  beforeEach(() => {
    userMock.findAll.mockResolvedValue([]);
    directoriesMock.prototype.deactivateUser.mockResolvedValue(true);
  });

  it("it throws an error if the directories API throws an error on instantiation", async () => {
    const errorMessage = "Test Error Directories";
    directoriesMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(
      deactivateUnusedAccounts({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`deactivateUnusedAccounts: ${errorMessage}`);
  });

  it("it throws an error if the audit logger throws an error on instantiation", async () => {
    const errorMessage = "Test Error Audit";
    auditLoggerMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(
      deactivateUnusedAccounts({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`deactivateUnusedAccounts: ${errorMessage}`);
  });

  it("it throws an error if the database connection for the User model throws an error", async () => {
    const connectionMock = jest.mocked(connection);
    const errorMessage = "Test Error DB Connection";
    connectionMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(
      deactivateUnusedAccounts({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`deactivateUnusedAccounts: ${errorMessage}`);
  });

  it("it attempts to initialise the User model with a connection to the directories DB", async () => {
    await deactivateUnusedAccounts({} as Timer, new InvocationContext());

    expect(initialiseUser).toHaveBeenCalled();
    expect(initialiseUser).toHaveBeenCalledWith(
      connection(DatabaseName.Directories),
    );
  });

  it("it throws an error if the user retrieval query throws an error", async () => {
    const errorMessage = "Test Error Query";
    userMock.findAll.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(
      deactivateUnusedAccounts({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`deactivateUnusedAccounts: ${errorMessage}`);
  });

  it("it performs the correct query to retrieve users who've been inactive for 2 years or more", async () => {
    const targetDate = Sequelize.fn(
      "DATEADD",
      Sequelize.literal("YEAR"),
      -2,
      Sequelize.fn("GETDATE"),
    );
    await deactivateUnusedAccounts({} as Timer, new InvocationContext());

    expect(userMock.findAll).toHaveBeenCalled();
    expect(userMock.findAll).toHaveBeenCalledWith({
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
  });

  it("it logs the number of users found by the query", async () => {
    const count = 97;
    userMock.findAll.mockResolvedValue(generateUsers(count));
    await deactivateUnusedAccounts({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      `deactivateUnusedAccounts: ${count} users found`,
    );
  });

  it("it logs the correct range of users being deactivated in the current batch", async () => {
    userMock.findAll.mockResolvedValue(generateUsers(150));
    await deactivateUnusedAccounts({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      "deactivateUnusedAccounts: Deactivating users 1 to 100",
    );
  });

  it("it calls deactivateUser with each user's ID and the invocation ID", async () => {
    const invocationId = "TestId";
    const queryResult: Pick<User, "id" | "email">[] = generateUsers(2);
    userMock.findAll.mockResolvedValue(queryResult as User[]);
    contextMock.prototype.invocationId = invocationId;
    await deactivateUnusedAccounts({} as Timer, new InvocationContext());

    expect(directoriesMock.prototype.deactivateUser).toHaveBeenCalledTimes(2);
    expect(directoriesMock.prototype.deactivateUser).toHaveBeenCalledWith(
      queryResult[0].id,
      "Automated task - Deactivate accounts with 2 years of inactivity.",
      invocationId,
    );
    expect(directoriesMock.prototype.deactivateUser).toHaveBeenCalledWith(
      queryResult[1].id,
      "Automated task - Deactivate accounts with 2 years of inactivity.",
      invocationId,
    );
  });

  it("it logs the correct number of successful, failed, and errored users in a batch", async () => {
    userMock.findAll.mockResolvedValue(generateUsers(25));
    directoriesMock.prototype.deactivateUser
      .mockRejectedValueOnce(new Error("Testing"))
      .mockRejectedValueOnce(new Error("Testing"))
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    await deactivateUnusedAccounts({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      "deactivateUnusedAccounts: 21 successful, 2 failed, and 2 errored deactivations for users 1 to 25",
    );
  });

  it("it logs unique errors from the deactivateUser call if there are any for a batch", async () => {
    const message1 = "Test 1";
    const message2 = "Test 2";
    const message3 = "Test 3";
    userMock.findAll.mockResolvedValue(generateUsers(10));
    directoriesMock.prototype.deactivateUser
      .mockRejectedValueOnce(new Error(message1))
      .mockRejectedValueOnce(new Error(message1))
      .mockRejectedValueOnce(new Error(message2))
      .mockRejectedValueOnce(new Error(message3))
      .mockRejectedValueOnce(new Error(message2))
      .mockResolvedValue(true);
    await deactivateUnusedAccounts({} as Timer, new InvocationContext());

    expect(contextMock.prototype.error).toHaveBeenCalledTimes(3);
    expect(contextMock.prototype.error).toHaveBeenCalledWith(
      `deactivateUnusedAccounts: ${message1}`,
    );
    expect(contextMock.prototype.error).toHaveBeenCalledWith(
      `deactivateUnusedAccounts: ${message2}`,
    );
    expect(contextMock.prototype.error).toHaveBeenCalledWith(
      `deactivateUnusedAccounts: ${message3}`,
    );
  });

  it("it throws an error if the entire batch errored (deactivateUser threw for all users)", async () => {
    userMock.findAll.mockResolvedValue(generateUsers(150));
    directoriesMock.prototype.deactivateUser.mockRejectedValue(new Error(""));

    await expect(
      deactivateUnusedAccounts({} as Timer, new InvocationContext()),
    ).rejects.toThrow(
      "deactivateUnusedAccounts: Entire batch had an error, failing execution so it can retry.",
    );
  });

  it("it doesn't throw an error if the deactivateUser call doesn't throw for all users in a batch", async () => {
    userMock.findAll.mockResolvedValue(generateUsers(5));
    directoriesMock.prototype.deactivateUser
      .mockRejectedValueOnce(new Error("Testing"))
      .mockResolvedValue(true);

    await expect(
      deactivateUnusedAccounts({} as Timer, new InvocationContext()),
    ).resolves.not.toThrow();
  });

  it("it doesn't log the number of successful users or send audit messages, if none were successfully deactivated", async () => {
    userMock.findAll.mockResolvedValue(generateUsers(5));
    directoriesMock.prototype.deactivateUser
      .mockRejectedValueOnce(new Error(""))
      .mockResolvedValue(false);
    await deactivateUnusedAccounts({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalled();
    expect(contextMock.prototype.info).not.toHaveBeenCalledWith(
      "deactivateUnusedAccounts: Sending audit messages for the 5 successful deactivations",
    );
    expect(auditLoggerMock.prototype.batchedLog).not.toHaveBeenCalled();
  });

  it("it logs the number of successful users having audit messages sent, if some were successfully deactivated", async () => {
    userMock.findAll.mockResolvedValue(generateUsers(5));
    directoriesMock.prototype.deactivateUser
      .mockRejectedValueOnce(new Error(""))
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    await deactivateUnusedAccounts({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      "deactivateUnusedAccounts: Sending audit messages for the 3 successful deactivations",
    );
  });

  it("it throws an error if the audit logger throws an error when sending a message batch", async () => {
    const errorMessage = "Testing Audit Logger Send";
    userMock.findAll.mockResolvedValue(generateUsers(5));
    auditLoggerMock.prototype.batchedLog.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(
      deactivateUnusedAccounts({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`deactivateUnusedAccounts: ${errorMessage}`);
  });

  it("it sends a batch of correct logs to the audit service bus for all the successful deactivations", async () => {
    const users = generateUsers(10);
    userMock.findAll.mockResolvedValue(users);
    await deactivateUnusedAccounts({} as Timer, new InvocationContext());

    expect(auditLoggerMock.prototype.batchedLog).toHaveBeenCalled();
    expect(auditLoggerMock.prototype.batchedLog).toHaveBeenCalledWith(
      users.map((user) => ({
        message: `Automated deactivation of user ${user.email} (id: ${user.id.toUpperCase()})`,
        type: "support",
        subType: "user-edit",
        meta: {
          reason:
            "Automated task - Deactivate accounts with 2 years of inactivity.",
          editedUser: user.id.toUpperCase(),
          editedFields: [
            {
              name: "status",
              oldValue: 1,
              newValue: 0,
            },
          ],
        },
      })),
    );
  });
});
