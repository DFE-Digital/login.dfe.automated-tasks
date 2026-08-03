import { InvocationContext, Timer } from "@azure/functions";
import { Client } from "@microsoft/microsoft-graph-client";
import { Op, Sequelize } from "sequelize";
import {
  findOrphanedEntraUsers,
  findUnlinkedDsiUsers,
  reconcileEntraDsiDrift,
} from "../../src/functions/reconcileEntraDsiDrift";
import { AuditLogger } from "../../src/infrastructure/AuditLogger";
import { createEntraGraphClient } from "../../src/infrastructure/api/entraGraph/createEntraGraphClient";
import {
  connection,
  DatabaseName,
} from "../../src/infrastructure/database/common/connection";
import { User } from "../../src/infrastructure/database/directories/User";

jest.mock("@azure/functions");
jest.mock("../../src/infrastructure/AuditLogger");
jest.mock("../../src/infrastructure/api/entraGraph/createEntraGraphClient");
jest.mock("../../src/infrastructure/database/common/connection");
jest.mock("../../src/infrastructure/database/directories/User");

describe("findUnlinkedDsiUsers", () => {
  const contextMock = jest.mocked(InvocationContext);
  const userMock = jest.mocked(User);

  const apiMock = {
    filter: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    get: jest.fn(),
  };
  const entraClientMock = {
    api: jest.fn().mockReturnValue(apiMock),
  } as unknown as Client;

  beforeEach(() => {
    jest.clearAllMocks();
    apiMock.filter.mockReturnThis();
    apiMock.select.mockReturnThis();
    // jest.config.js sets resetMocks: true, which wipes mockReturnValue before
    // every test, so the api() -> chain mock must be re-established here too.
    (entraClientMock.api as jest.Mock).mockReturnValue(apiMock);
  });

  it("returns no anomalies when there are no unlinked internal user candidates", async () => {
    userMock.findAll.mockResolvedValue([]);

    const result = await findUnlinkedDsiUsers(
      entraClientMock,
      new InvocationContext(),
      14,
    );

    expect(result).toEqual([]);
    expect(apiMock.get).not.toHaveBeenCalled();
  });

  it("performs the correct query to retrieve unlinked internal user candidates on the User model", async () => {
    const minAgeDays = 14;
    const query = {
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
    };
    userMock.findAll.mockResolvedValue([]);

    await findUnlinkedDsiUsers(
      entraClientMock,
      new InvocationContext(),
      minAgeDays,
    );

    expect(userMock.findAll).toHaveBeenCalled();
    expect(userMock.findAll).toHaveBeenCalledWith(query);
  });

  it("flags a candidate that has a matching Entra account", async () => {
    userMock.findAll.mockResolvedValue([
      {
        id: "8f6a9b1e-9e3a-4b8e-9f1a-9b2c3d4e5f6a",
        email: "jo.bradford@example.com",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
      } as User,
    ]);
    apiMock.get.mockResolvedValue({
      value: [{ id: "21892c65-88df-4268-b025-d06f51c52404" }],
    });

    const result = await findUnlinkedDsiUsers(
      entraClientMock,
      new InvocationContext(),
      14,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "support",
      subType: "unlinked-entra-account",
      userId: "8f6a9b1e-9e3a-4b8e-9f1a-9b2c3d4e5f6a",
    });
  });

  it("does not flag a candidate with no matching Entra account", async () => {
    userMock.findAll.mockResolvedValue([
      {
        id: "8f6a9b1e-9e3a-4b8e-9f1a-9b2c3d4e5f6a",
        email: "jo.bradford@example.com",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
      } as User,
    ]);
    apiMock.get.mockResolvedValue({ value: [] });

    const result = await findUnlinkedDsiUsers(
      entraClientMock,
      new InvocationContext(),
      14,
    );

    expect(result).toEqual([]);
  });

  it("logs and skips a candidate when the Graph API lookup fails, without throwing", async () => {
    userMock.findAll.mockResolvedValue([
      {
        id: "8f6a9b1e-9e3a-4b8e-9f1a-9b2c3d4e5f6a",
        email: "jo.bradford@example.com",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
      } as User,
    ]);
    apiMock.get.mockRejectedValue(new Error("Graph API unavailable"));

    const result = await findUnlinkedDsiUsers(
      entraClientMock,
      new InvocationContext(),
      14,
    );

    expect(result).toEqual([]);
    expect(contextMock.prototype.error).toHaveBeenCalled();
  });
});

describe("findOrphanedEntraUsers", () => {
  const userMock = jest.mocked(User);

  const apiMock = {
    header: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    get: jest.fn(),
  };
  const entraClientMock = {
    api: jest.fn().mockReturnValue(apiMock),
  } as unknown as Client;

  beforeEach(() => {
    jest.clearAllMocks();
    apiMock.header.mockReturnThis();
    apiMock.count.mockReturnThis();
    apiMock.filter.mockReturnThis();
    apiMock.select.mockReturnThis();
    // jest.config.js sets resetMocks: true, which wipes mockReturnValue before
    // every test, so the api() -> chain mock must be re-established here too.
    (entraClientMock.api as jest.Mock).mockReturnValue(apiMock);
  });

  it("returns no anomalies when no Entra users were recently created", async () => {
    apiMock.get.mockResolvedValue({ value: [] });

    const result = await findOrphanedEntraUsers(
      entraClientMock,
      new InvocationContext(),
      7,
    );

    expect(result).toEqual([]);
    expect(userMock.findAll).not.toHaveBeenCalled();
  });

  it("flags a recently created Entra user with no matching DSI row", async () => {
    apiMock.get.mockResolvedValue({
      value: [
        {
          id: "21892c65-88df-4268-b025-d06f51c52404",
          mail: "jo.bradford@example.com",
          createdDateTime: "2026-07-30T00:00:00.000Z",
        },
      ],
    });
    userMock.findAll.mockResolvedValue([]);

    const result = await findOrphanedEntraUsers(
      entraClientMock,
      new InvocationContext(),
      7,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "support",
      subType: "orphaned-entra-account",
    });
  });

  it("does not flag a recently created Entra user that has a matching DSI row", async () => {
    apiMock.get.mockResolvedValue({
      value: [
        {
          id: "21892c65-88df-4268-b025-d06f51c52404",
          mail: "jo.bradford@example.com",
          createdDateTime: "2026-07-30T00:00:00.000Z",
        },
      ],
    });
    userMock.findAll.mockResolvedValue([
      { entraId: "21892c65-88df-4268-b025-d06f51c52404" } as User,
    ]);

    const result = await findOrphanedEntraUsers(
      entraClientMock,
      new InvocationContext(),
      7,
    );

    expect(result).toEqual([]);
  });
});

describe("reconcileEntraDsiDrift", () => {
  const contextMock = jest.mocked(InvocationContext);
  const auditLoggerMock = jest.mocked(AuditLogger);
  const createEntraClientMock = jest.mocked(createEntraGraphClient);
  const connectionMock = jest.mocked(connection);
  const userMock = jest.mocked(User);

  const apiMock = {
    header: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    apiMock.header.mockReturnThis();
    apiMock.count.mockReturnThis();
    apiMock.filter.mockReturnThis();
    apiMock.select.mockReturnThis();
    apiMock.get.mockResolvedValue({ value: [] });
    createEntraClientMock.mockReturnValue({
      api: jest.fn().mockReturnValue(apiMock),
    } as unknown as Client);
    userMock.findAll.mockResolvedValue([]);
    auditLoggerMock.prototype.batchedLog.mockResolvedValue();
  });

  it("logs a warning if the timer is marked as past due, without executing", async () => {
    await reconcileEntraDsiDrift(
      { isPastDue: true } as Timer,
      new InvocationContext(),
    );

    expect(contextMock.prototype.warn).toHaveBeenCalledWith(
      "reconcileEntraDsiDrift: Timer is marked as past due, and attempted to run the function",
    );
    expect(userMock.findAll).not.toHaveBeenCalled();
  });

  it("does not write to the audit log when no anomalies are found", async () => {
    await reconcileEntraDsiDrift(
      { isPastDue: false } as Timer,
      new InvocationContext(),
    );

    expect(connectionMock).toHaveBeenCalledWith(DatabaseName.Directories);
    expect(auditLoggerMock.prototype.batchedLog).not.toHaveBeenCalled();
  });

  it("batches anomalies from both directions into a single audit log call", async () => {
    userMock.findAll.mockResolvedValueOnce([
      {
        id: "8f6a9b1e-9e3a-4b8e-9f1a-9b2c3d4e5f6a",
        email: "jo.bradford@example.com",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
      } as User,
    ]);
    apiMock.get
      .mockResolvedValueOnce({
        value: [{ id: "21892c65-88df-4268-b025-d06f51c52404" }],
      })
      .mockResolvedValueOnce({
        value: [
          {
            id: "c64bc171-ceef-4656-b22d-43918c14210f",
            mail: "alex.johnson@example.com",
            createdDateTime: "2026-07-30T00:00:00.000Z",
          },
        ],
      });
    userMock.findAll.mockResolvedValueOnce([]);

    await reconcileEntraDsiDrift(
      { isPastDue: false } as Timer,
      new InvocationContext(),
    );

    expect(auditLoggerMock.prototype.batchedLog).toHaveBeenCalledTimes(1);
    const loggedAnomalies =
      auditLoggerMock.prototype.batchedLog.mock.calls[0][0];
    expect(loggedAnomalies).toHaveLength(2);
  });
});
