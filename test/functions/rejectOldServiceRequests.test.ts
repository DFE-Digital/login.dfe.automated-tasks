import { InvocationContext, Timer } from "@azure/functions";
import { NotificationClient } from "login.dfe.jobs-client";
import { Op } from "sequelize";
import { Access } from "../../src/infrastructure/api/dsiInternal/Access";
import { Applications } from "../../src/infrastructure/api/dsiInternal/Applications";
import { Directories } from "../../src/infrastructure/api/dsiInternal/Directories";
import { Organisations } from "../../src/infrastructure/api/dsiInternal/Organisations";
import { rejectOldServiceRequests } from "../../src/functions/rejectOldServiceRequests";
import { AuditLogger } from "../../src/infrastructure/AuditLogger";
import {
  connection,
  DatabaseName,
} from "../../src/infrastructure/database/common/connection";
import {
  initialiseUserServiceRequest,
  UserServiceRequest,
} from "../../src/infrastructure/database/organisations/UserServiceRequest";
import { checkEnv } from "../../src/infrastructure/utils";
import { generateSafeUser, generateServiceRequest } from "../testUtils";

jest.mock("@azure/functions");
jest.mock("login.dfe.jobs-client");
jest.mock("../../src/infrastructure/AuditLogger");
jest.mock("../../src/infrastructure/api/dsiInternal/Access");
jest.mock("../../src/infrastructure/api/dsiInternal/Applications");
jest.mock("../../src/infrastructure/api/dsiInternal/Directories");
jest.mock("../../src/infrastructure/api/dsiInternal/Organisations");
jest.mock("../../src/infrastructure/database/common/connection");
jest.mock("../../src/infrastructure/database/organisations/UserServiceRequest");
jest.mock("../../src/infrastructure/utils");

describe("Reject old overdue user service requests automated task", () => {
  const contextMock = jest.mocked(InvocationContext);
  const checkEnvMock = jest.mocked(checkEnv);
  const connectionMock = jest.mocked(connection);
  const initialiseUserServiceRequestMock = jest.mocked(
    initialiseUserServiceRequest,
  );
  const userServiceRequestMock = jest.mocked(UserServiceRequest);
  const accessMock = jest.mocked(Access);
  const applicationsMock = jest.mocked(Applications);
  const directoriesMock = jest.mocked(Directories);
  const organisationsMock = jest.mocked(Organisations);
  const auditLoggerMock = jest.mocked(AuditLogger);
  const notificationClientMock = jest.mocked(NotificationClient);

  const environment = { ...process.env };

  beforeEach(() => {
    process.env = {};
    userServiceRequestMock.findAll.mockResolvedValue([]);
    accessMock.prototype.updateServiceRequest.mockResolvedValue(true);
    applicationsMock.prototype.getServiceById.mockResolvedValue(null);
    directoriesMock.prototype.getUsersByIds.mockResolvedValue([]);
    organisationsMock.prototype.getOrganisationById.mockResolvedValue(null);
    notificationClientMock.mockImplementation(() => ({
      sendAccessRequest: jest.fn(),
      sendServiceRequestRejected: jest.fn(),
    }));
  });

  afterEach(() => {
    process.env = environment;
    jest.useRealTimers();
  });

  it("it logs a warning if the timer is marked as past due, without executing", async () => {
    await rejectOldServiceRequests(
      { isPastDue: true } as Timer,
      new InvocationContext(),
    );

    expect(contextMock.prototype.warn).toHaveBeenCalledWith(
      "rejectOldServiceRequests: Timer is marked as past due, and attempted to run the function",
    );
    expect(userServiceRequestMock.findAll).not.toHaveBeenCalled();
  });

  it("it will call checkEnv with the required environment variables for rejecting requests and connecting to Redis", async () => {
    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(checkEnvMock).toHaveBeenCalledWith(
      ["REDIS_CONNECTION_STRING", "SUPPORT_USER_ID"],
      "valid request rejections or Redis",
    );
  });

  it("it throws an error if checkEnv throws an error when any required environment variable is not set", async () => {
    const errorMessage = "Test Error";
    checkEnvMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(
      rejectOldServiceRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldServiceRequests: ${errorMessage}`);
  });

  it("it throws an error if the database connection throws an error", async () => {
    const errorMessage = "Test Error DB Connection";
    connectionMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(
      rejectOldServiceRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldServiceRequests: ${errorMessage}`);
  });

  it("it attempts to initialise the service request model with a connection to the organisations DB", async () => {
    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(initialiseUserServiceRequestMock).toHaveBeenCalledWith(
      connection(DatabaseName.Organisations),
    );
  });

  it.each([
    ["Access", accessMock],
    ["Applications", applicationsMock],
    ["Directories", directoriesMock],
    ["Organisations", organisationsMock],
  ])(
    "it throws an error if any of the APIs throw an error on instantiation (%p)",
    async (name, mock) => {
      const errorMessage = `Test Error ${name}`;
      mock.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await expect(
        rejectOldServiceRequests({} as Timer, new InvocationContext()),
      ).rejects.toThrow(`rejectOldServiceRequests: ${errorMessage}`);
    },
  );

  it("it throws an error if the audit logger throws an error on instantiation", async () => {
    const errorMessage = "Test Error Audit";
    auditLoggerMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(
      rejectOldServiceRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldServiceRequests: ${errorMessage}`);
  });

  it("it creates a NotificationClient instance pointing to the jobs DB in Redis", async () => {
    const testConnectionString = "testing";
    process.env.REDIS_CONNECTION_STRING = testConnectionString;
    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(notificationClientMock).toHaveBeenCalledWith({
      connectionString: `${testConnectionString}/4?tls=true`,
    });
  });

  it("it performs the correct query to retrieve old overdue/no approver service requests", async () => {
    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(userServiceRequestMock.findAll).toHaveBeenCalledWith({
      attributes: [
        "id",
        "userId",
        "organisationId",
        "serviceId",
        "roleIds",
        "createdAt",
      ],
      where: {
        status: { [Op.in]: [2, 3] },
        createdAt: { [Op.lt]: expect.any(Date) },
      },
    });
  });

  it("it throws an error if the findAll query throws an error", async () => {
    const errorMessage = "Test Error";
    userServiceRequestMock.findAll.mockRejectedValue(new Error(errorMessage));

    await expect(
      rejectOldServiceRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldServiceRequests: ${errorMessage}`);
  });

  it("it doesn't attempt to update any requests if there are no old overdue/no approver requests", async () => {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - 3);

    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(accessMock.prototype.updateServiceRequest).not.toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      `rejectOldServiceRequests: No overdue/no approver service requests available older than ${targetDate.toLocaleDateString("en-GB")}`,
    );
  });

  it("it logs the number of requests to be rejected", async () => {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - 3);
    userServiceRequestMock.findAll.mockResolvedValue([
      generateServiceRequest("user-1", "svc-1", "org-1"),
      generateServiceRequest("user-2", "svc-1", "org-1"),
      generateServiceRequest("user-3", "svc-1", "org-1"),
    ] as UserServiceRequest[]);

    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      `rejectOldServiceRequests: Rejecting 3 overdue/no approver service requests older than ${targetDate.toLocaleDateString("en-GB")}`,
    );
  });

  it("it attempts to update each old service request individually with the expected rejection properties", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    const supportId = "Test Support ID";
    process.env.SUPPORT_USER_ID = supportId;
    const invocationId = "TestInvocationId";
    contextMock.prototype.invocationId = invocationId;
    const requests = [
      generateServiceRequest("user-1", "svc-1", "org-1"),
      generateServiceRequest("user-2", "svc-1", "org-1"),
    ];
    userServiceRequestMock.findAll.mockResolvedValue(
      requests as UserServiceRequest[],
    );

    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(accessMock.prototype.updateServiceRequest).toHaveBeenCalledTimes(2);
    expect(accessMock.prototype.updateServiceRequest).toHaveBeenCalledWith(
      requests[0].id,
      {
        status: -1,
        actioned_by: supportId,
        actioned_at: "2024-01-01T00:00:00.000Z",
        actioned_reason:
          "Automated task - Approvers did not action request within 3 months",
      },
      invocationId,
    );
    expect(accessMock.prototype.updateServiceRequest).toHaveBeenCalledWith(
      requests[1].id,
      {
        status: -1,
        actioned_by: supportId,
        actioned_at: "2024-01-01T00:00:00.000Z",
        actioned_reason:
          "Automated task - Approvers did not action request within 3 months",
      },
      invocationId,
    );
  });

  it("it logs the correct number of successful, failed, and errored request rejections", async () => {
    userServiceRequestMock.findAll.mockResolvedValue([
      generateServiceRequest("user-1", "svc-1", "org-1"),
      generateServiceRequest("user-2", "svc-1", "org-1"),
      generateServiceRequest("user-3", "svc-1", "org-1"),
      generateServiceRequest("user-4", "svc-1", "org-1"),
      generateServiceRequest("user-5", "svc-1", "org-1"),
      generateServiceRequest("user-6", "svc-1", "org-1"),
    ] as UserServiceRequest[]);
    accessMock.prototype.updateServiceRequest
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error("Test Error"))
      .mockRejectedValueOnce(new Error("Test Error"));

    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      "rejectOldServiceRequests: 3 successful, 1 failed, and 2 errored rejections for 6 service requests",
    );
  });

  it("it logs unique errors from the update call if there are any", async () => {
    const message1 = "Test 1";
    const message2 = "Test 2";
    userServiceRequestMock.findAll.mockResolvedValue([
      generateServiceRequest("user-1", "svc-1", "org-1"),
      generateServiceRequest("user-2", "svc-1", "org-1"),
      generateServiceRequest("user-3", "svc-1", "org-1"),
      generateServiceRequest("user-4", "svc-1", "org-1"),
    ] as UserServiceRequest[]);
    accessMock.prototype.updateServiceRequest
      .mockRejectedValueOnce(new Error(message1))
      .mockRejectedValueOnce(new Error(message1))
      .mockRejectedValueOnce(new Error(message2))
      .mockResolvedValue(true);

    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(contextMock.prototype.error).toHaveBeenCalledTimes(2);
    expect(contextMock.prototype.error).toHaveBeenCalledWith(
      `rejectOldServiceRequests: ${message1}`,
    );
    expect(contextMock.prototype.error).toHaveBeenCalledWith(
      `rejectOldServiceRequests: ${message2}`,
    );
  });

  it("it throws an error if all request rejections had an error", async () => {
    userServiceRequestMock.findAll.mockResolvedValue([
      generateServiceRequest("user-1", "svc-1", "org-1"),
      generateServiceRequest("user-2", "svc-1", "org-1"),
    ] as UserServiceRequest[]);
    accessMock.prototype.updateServiceRequest.mockRejectedValue(new Error(""));

    await expect(
      rejectOldServiceRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(
      "rejectOldServiceRequests: All request rejections had an error, failing execution so it can retry.",
    );
  });

  it("it doesn't throw an error if the update call doesn't error for all requests", async () => {
    userServiceRequestMock.findAll.mockResolvedValue([
      generateServiceRequest("user-1", "svc-1", "org-1"),
      generateServiceRequest("user-2", "svc-1", "org-1"),
    ] as UserServiceRequest[]);
    accessMock.prototype.updateServiceRequest
      .mockRejectedValueOnce(new Error(""))
      .mockResolvedValue(true);

    await expect(
      rejectOldServiceRequests({} as Timer, new InvocationContext()),
    ).resolves.not.toThrow();
  });

  it("it doesn't attempt to send any audit logs or notifications if none were successfully rejected", async () => {
    userServiceRequestMock.findAll.mockResolvedValue([
      generateServiceRequest("user-1", "svc-1", "org-1"),
      generateServiceRequest("user-2", "svc-1", "org-1"),
    ] as UserServiceRequest[]);
    accessMock.prototype.updateServiceRequest.mockResolvedValue(false);

    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(auditLoggerMock.prototype.batchedLog).not.toHaveBeenCalled();
    expect(directoriesMock.prototype.getUsersByIds).not.toHaveBeenCalled();
    expect(
      organisationsMock.prototype.getOrganisationById,
    ).not.toHaveBeenCalled();
    expect(applicationsMock.prototype.getServiceById).not.toHaveBeenCalled();
  });

  it("it logs the number of successful request rejections having audit messages sent", async () => {
    userServiceRequestMock.findAll.mockResolvedValue([
      generateServiceRequest("user-1", "svc-1", "org-1"),
      generateServiceRequest("user-2", "svc-1", "org-1"),
      generateServiceRequest("user-3", "svc-1", "org-1"),
    ] as UserServiceRequest[]);
    accessMock.prototype.updateServiceRequest
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);

    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      "rejectOldServiceRequests: Sending audit messages for the 2 successfully rejected requests",
    );
  });

  it("it throws an error if the audit logger throws when sending a message batch", async () => {
    const errorMessage = "Testing Audit Logger Send";
    userServiceRequestMock.findAll.mockResolvedValue([
      generateServiceRequest("user-1", "svc-1", "org-1"),
    ] as UserServiceRequest[]);
    auditLoggerMock.prototype.batchedLog.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(
      rejectOldServiceRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldServiceRequests: ${errorMessage}`);
  });

  it("it sends a batch of correct logs to the audit service bus for all successfully rejected requests", async () => {
    const supportId = "Test Support ID";
    process.env.SUPPORT_USER_ID = supportId;
    const requests = [
      generateServiceRequest("user-1", "svc-1", "org-1"),
      generateServiceRequest("user-2", "svc-2", "org-2"),
      generateServiceRequest("user-3", "svc-1", "org-1"),
    ];
    userServiceRequestMock.findAll.mockResolvedValue(
      requests as UserServiceRequest[],
    );

    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(auditLoggerMock.prototype.batchedLog).toHaveBeenCalledWith(
      requests.map((request) => ({
        message: "Automated rejection of requests older than 3 months",
        type: "approver",
        subType: "rejected-service",
        userId: supportId,
        organisationid: request.organisationId,
        meta: {
          editedUser: request.userId,
          reason:
            "Automated task - Approvers did not action request within 3 months",
        },
      })),
    );
  });

  it("it logs the number of successful request rejections that could have notifications sent", async () => {
    userServiceRequestMock.findAll.mockResolvedValue([
      generateServiceRequest("user-1", "svc-1", "org-1"),
      generateServiceRequest("user-2", "svc-1", "org-1"),
      generateServiceRequest("user-3", "svc-1", "org-1"),
      generateServiceRequest("user-4", "svc-1", "org-1"),
      generateServiceRequest("user-5", "svc-1", "org-1"),
    ] as UserServiceRequest[]);
    accessMock.prototype.updateServiceRequest
      .mockRejectedValueOnce(new Error(""))
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);

    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      "rejectOldServiceRequests: Retrieving user information for the 3 successfully rejected requests",
    );
  });

  it("it throws an error if the attempt to retrieve user information throws an error", async () => {
    const errorMessage = "Test Error";
    userServiceRequestMock.findAll.mockResolvedValue([
      generateServiceRequest("user-1", "svc-1", "org-1"),
    ] as UserServiceRequest[]);
    directoriesMock.prototype.getUsersByIds.mockRejectedValue(
      new Error(errorMessage),
    );

    await expect(
      rejectOldServiceRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldServiceRequests: ${errorMessage}`);
  });

  it("it attempts to retrieve user information for the distinct user IDs of the successful rejections with the invocation ID", async () => {
    const user1 = "user-1";
    const user2 = "user-2";
    const user3 = "user-3";
    const invocationId = "TestId";
    contextMock.prototype.invocationId = invocationId;
    const requests = [
      generateServiceRequest(user1, "svc-1", "org-1"),
      generateServiceRequest(user2, "svc-1", "org-1"),
      generateServiceRequest(user3, "svc-1", "org-1"),
      generateServiceRequest(user3, "svc-1", "org-1"),
      generateServiceRequest(user2, "svc-1", "org-1"),
    ];
    userServiceRequestMock.findAll.mockResolvedValue(
      requests as UserServiceRequest[],
    );

    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(directoriesMock.prototype.getUsersByIds).toHaveBeenCalledWith(
      [user1, user2, user3],
      invocationId,
    );
  });

  it("it throws an error if the attempt to retrieve organisation names throws an error", async () => {
    const errorMessage = "Test Error Org";
    userServiceRequestMock.findAll.mockResolvedValue([
      generateServiceRequest("user-1", "svc-1", "org-1"),
    ] as UserServiceRequest[]);
    organisationsMock.prototype.getOrganisationById.mockRejectedValue(
      new Error(errorMessage),
    );

    await expect(
      rejectOldServiceRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldServiceRequests: ${errorMessage}`);
  });

  it("it attempts to retrieve organisation names for the distinct organisation IDs of the successful rejections", async () => {
    const org1 = "org-1";
    const org2 = "org-2";
    const invocationId = "TestId";
    contextMock.prototype.invocationId = invocationId;
    const requests = [
      generateServiceRequest("user-1", "svc-1", org1),
      generateServiceRequest("user-2", "svc-1", org2),
      generateServiceRequest("user-3", "svc-1", org1),
    ];
    userServiceRequestMock.findAll.mockResolvedValue(
      requests as UserServiceRequest[],
    );

    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(organisationsMock.prototype.getOrganisationById).toHaveBeenCalledTimes(2);
    expect(organisationsMock.prototype.getOrganisationById).toHaveBeenCalledWith(org1, invocationId);
    expect(organisationsMock.prototype.getOrganisationById).toHaveBeenCalledWith(org2, invocationId);
  });

  it("it throws an error if the attempt to retrieve service names throws an error", async () => {
    const errorMessage = "Test Error Service";
    userServiceRequestMock.findAll.mockResolvedValue([
      generateServiceRequest("user-1", "svc-1", "org-1"),
    ] as UserServiceRequest[]);
    applicationsMock.prototype.getServiceById.mockRejectedValue(
      new Error(errorMessage),
    );

    await expect(
      rejectOldServiceRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldServiceRequests: ${errorMessage}`);
  });

  it("it attempts to retrieve service names for the distinct service IDs of the successful rejections", async () => {
    const svc1 = "svc-1";
    const svc2 = "svc-2";
    const invocationId = "TestId";
    contextMock.prototype.invocationId = invocationId;
    const requests = [
      generateServiceRequest("user-1", svc1, "org-1"),
      generateServiceRequest("user-2", svc2, "org-1"),
      generateServiceRequest("user-3", svc1, "org-1"),
    ];
    userServiceRequestMock.findAll.mockResolvedValue(
      requests as UserServiceRequest[],
    );

    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(applicationsMock.prototype.getServiceById).toHaveBeenCalledTimes(2);
    expect(applicationsMock.prototype.getServiceById).toHaveBeenCalledWith(svc1, invocationId);
    expect(applicationsMock.prototype.getServiceById).toHaveBeenCalledWith(svc2, invocationId);
  });

  it("it logs the correct number of rejections receiving email notifications as they are linked to active users", async () => {
    const requests = [
      generateServiceRequest("user-1", "svc-1", "org-1"),
      generateServiceRequest("user-2", "svc-1", "org-1"),
      generateServiceRequest("user-3", "svc-1", "org-1"),
      generateServiceRequest("user-4", "svc-1", "org-1"),
    ];
    userServiceRequestMock.findAll.mockResolvedValue(
      requests as UserServiceRequest[],
    );
    directoriesMock.prototype.getUsersByIds.mockResolvedValue([
      generateSafeUser("user-1", "", 1),
      generateSafeUser("user-3", "", 0),
      generateSafeUser("user-4", "", 1),
    ]);

    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      "rejectOldServiceRequests: Sending rejection emails for the 2 successfully rejected requests with active users",
    );
  });

  it("it doesn't send any notifications if none of the successful rejections are linked to active users", async () => {
    userServiceRequestMock.findAll.mockResolvedValue([
      generateServiceRequest("user-1", "svc-1", "org-1"),
      generateServiceRequest("user-2", "svc-1", "org-1"),
    ] as UserServiceRequest[]);
    directoriesMock.prototype.getUsersByIds.mockResolvedValue([
      generateSafeUser("user-1", "", 0),
      generateSafeUser("user-2", "", 0),
    ]);
    const sendServiceRequestRejected = jest.fn();
    notificationClientMock.mockImplementation(() => ({
      sendAccessRequest: jest.fn(),
      sendServiceRequestRejected,
    }));

    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(sendServiceRequestRejected).not.toHaveBeenCalled();
    expect(contextMock.prototype.info).not.toHaveBeenCalledWith(
      expect.stringContaining("Sending rejection emails for the 0"),
    );
  });

  it("it throws an error if the notifications client throws when sending a notification", async () => {
    const errorMessage = "Test Error";
    userServiceRequestMock.findAll.mockResolvedValue([
      generateServiceRequest("user-1", "svc-1", "org-1"),
    ] as UserServiceRequest[]);
    directoriesMock.prototype.getUsersByIds.mockResolvedValue([
      generateSafeUser("user-1", "", 1),
    ]);
    notificationClientMock.mockImplementation(() => ({
      sendAccessRequest: jest.fn(),
      sendServiceRequestRejected: jest.fn(() => {
        throw new Error(errorMessage);
      }),
    }));

    await expect(
      rejectOldServiceRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldServiceRequests: ${errorMessage}`);
  });

  it("it sends a notification with the correct arguments for all the successful rejections linked to active users", async () => {
    const requests = [
      generateServiceRequest("user-1", "svc-1", "org-1"),
      generateServiceRequest("user-1", "svc-2", "org-2"),
      generateServiceRequest("user-2", "svc-1", "org-1"),
    ];
    const users = [
      generateSafeUser("user-1", "user-1@test.com", 1, {
        given_name: "User1",
        family_name: "Test",
      }),
      generateSafeUser("user-2", "user-2@test.com", 1, {
        given_name: "User2",
        family_name: "Test",
      }),
    ];
    userServiceRequestMock.findAll.mockResolvedValue(
      requests as UserServiceRequest[],
    );
    directoriesMock.prototype.getUsersByIds.mockResolvedValue(users);
    organisationsMock.prototype.getOrganisationById.mockImplementation(
      (id: string) =>
        Promise.resolve(id === "org-1"
          ? { id: "org-1", name: "Org 1" }
          : { id: "org-2", name: "Org 2" }),
    );
    applicationsMock.prototype.getServiceById.mockImplementation(
      (id: string) =>
        Promise.resolve(id === "svc-1"
          ? { id: "svc-1", name: "Service 1" }
          : { id: "svc-2", name: "Service 2" }),
    );
    const sendServiceRequestRejected = jest.fn();
    notificationClientMock.mockImplementation(() => ({
      sendAccessRequest: jest.fn(),
      sendServiceRequestRejected,
    }));

    await rejectOldServiceRequests({} as Timer, new InvocationContext());

    expect(sendServiceRequestRejected).toHaveBeenCalledTimes(3);
    expect(sendServiceRequestRejected).toHaveBeenNthCalledWith(
      1,
      users[0].email,
      users[0].given_name,
      users[0].family_name,
      "Org 1",
      "Service 1",
      [],
      "The approver(s) at the organisation haven't taken any action on your request, which was made more than 3 months ago.",
    );
    expect(sendServiceRequestRejected).toHaveBeenNthCalledWith(
      2,
      users[0].email,
      users[0].given_name,
      users[0].family_name,
      "Org 2",
      "Service 2",
      [],
      "The approver(s) at the organisation haven't taken any action on your request, which was made more than 3 months ago.",
    );
    expect(sendServiceRequestRejected).toHaveBeenNthCalledWith(
      3,
      users[1].email,
      users[1].given_name,
      users[1].family_name,
      "Org 1",
      "Service 1",
      [],
      "The approver(s) at the organisation haven't taken any action on your request, which was made more than 3 months ago.",
    );
  });
});
