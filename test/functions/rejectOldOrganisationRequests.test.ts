import { InvocationContext, Timer } from "@azure/functions";
import { NotificationClient } from "login.dfe.jobs-client";
import { Directories } from "../../src/infrastructure/api/dsiInternal/Directories";
import { Organisations } from "../../src/infrastructure/api/dsiInternal/Organisations";
import { rejectOldOrganisationRequests } from "../../src/functions/rejectOldOrganisationRequests";
import { checkEnv } from "../../src/infrastructure/utils";
import { generateOrganisationRequest, generateSafeUser } from "../testUtils";
import { AuditLogger } from "../../src/infrastructure/AuditLogger";

jest.mock("@azure/functions");
jest.mock("login.dfe.jobs-client");
jest.mock("../../src/infrastructure/AuditLogger");
jest.mock("../../src/infrastructure/api/dsiInternal/Directories");
jest.mock("../../src/infrastructure/api/dsiInternal/Organisations");
jest.mock("../../src/infrastructure/utils");

describe("Reject old overdue user organisation requests automated task", () => {
  const contextMock = jest.mocked(InvocationContext);
  const checkEnvMock = jest.mocked(checkEnv);
  const directoriesMock = jest.mocked(Directories);
  const organisationsMock = jest.mocked(Organisations);
  const auditLoggerMock = jest.mocked(AuditLogger);
  const notificationClientMock = jest.mocked(NotificationClient);

  const olderTestDate = new Date();
  olderTestDate.setMonth(olderTestDate.getMonth() - 4);

  const blankOrganisationRequestPage = {
    requests: [],
    page: 2,
    totalNumberOfPages: 0,
    totalNumberOfRecords: 0,
  };

  beforeEach(() => {
    organisationsMock.prototype.getOrganisationRequestPage.mockResolvedValue({
      requests: [],
      page: 1,
      totalNumberOfPages: 0,
      totalNumberOfRecords: 0,
    });
    organisationsMock.prototype.updateOrganisationRequest.mockResolvedValue(
      true,
    );
    directoriesMock.prototype.getUsersByIds.mockResolvedValue([]);
    notificationClientMock.mockImplementation(() => ({
      sendAccessRequest: jest.fn(),
    }));
  });

  it("it will call checkEnv with the required environment variable and name for connecting to Redis", async () => {
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(checkEnvMock).toHaveBeenCalled();
    expect(checkEnvMock).toHaveBeenCalledWith(
      ["REDIS_CONNECTION_STRING"],
      "Redis",
    );
  });

  it("it throws an error if checkEnv throws an error when the Redis connection string environment variable is not set", async () => {
    const errorMessage = "Test Error";
    checkEnvMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(
      rejectOldOrganisationRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldOrganisationRequests: ${errorMessage}`);
  });

  it.each([
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
        rejectOldOrganisationRequests({} as Timer, new InvocationContext()),
      ).rejects.toThrow(`rejectOldOrganisationRequests: ${errorMessage}`);
    },
  );

  it("it throws an error if the audit logger throws an error on instantiation", async () => {
    const errorMessage = "Test Error Audit";
    auditLoggerMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(
      rejectOldOrganisationRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldOrganisationRequests: ${errorMessage}`);
  });

  it("it creates a NotificationClient instance pointing to the jobs DB in Redis", async () => {
    const currentEnv = { ...process.env };
    const testConnectionString = "testing";
    process.env.REDIS_CONNECTION_STRING = testConnectionString;
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(notificationClientMock).toHaveBeenCalled();
    expect(notificationClientMock).toHaveBeenCalledWith({
      connectionString: `${testConnectionString}/4?tls=true`,
    });

    process.env = currentEnv;
  });

  it("it throws an error if the first page retrieval of overdue organisation requests throws an error", async () => {
    const errorMessage = "Test Error";
    organisationsMock.prototype.getOrganisationRequestPage.mockRejectedValue(
      new Error(errorMessage),
    );

    await expect(
      rejectOldOrganisationRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldOrganisationRequests: ${errorMessage}`);
  });

  it("it attempts to retrieve the first page of overdue organisation requests with the invocation ID", async () => {
    const invocationId = "TestId";
    contextMock.prototype.invocationId = invocationId;
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(
      organisationsMock.prototype.getOrganisationRequestPage,
    ).toHaveBeenCalled();
    expect(
      organisationsMock.prototype.getOrganisationRequestPage,
    ).toHaveBeenCalledWith(1, invocationId, [2]);
  });

  it("it doesn't attempt to update any requests if the first page request says there are 0 pages/records", async () => {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - 3);

    organisationsMock.prototype.getOrganisationRequestPage.mockResolvedValue({
      requests: [],
      page: 1,
      totalNumberOfPages: 0,
      totalNumberOfRecords: 0,
    });
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(
      organisationsMock.prototype.updateOrganisationRequest,
    ).not.toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      `rejectOldOrganisationRequests: No more overdue organisation requests available older than ${targetDate.toLocaleDateString()}`,
    );
  });

  it("it doesn't attempt to update any requests if the first page request has no records older than 3 months", async () => {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - 3);

    organisationsMock.prototype.getOrganisationRequestPage.mockResolvedValue({
      requests: [
        generateOrganisationRequest("", "", new Date().toISOString()),
        generateOrganisationRequest("", "", new Date().toISOString()),
        generateOrganisationRequest("", "", new Date().toISOString()),
      ],
      page: 1,
      totalNumberOfPages: 1,
      totalNumberOfRecords: 3,
    });
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(
      organisationsMock.prototype.updateOrganisationRequest,
    ).not.toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      `rejectOldOrganisationRequests: No more overdue organisation requests available older than ${targetDate.toLocaleDateString()}`,
    );
  });

  it("it logs the number of requests older than the target date as well as the page number", async () => {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - 3);
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests: [
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", new Date().toISOString()),
          generateOrganisationRequest("", "", new Date().toISOString()),
        ],
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 4,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      `rejectOldOrganisationRequests: Rejecting 2 overdue organisation requests older than ${targetDate.toLocaleDateString()} in page 1`,
    );
  });

  it("it attempts to update the old organisation requests using the correct request IDs, invocation ID, and properties", async () => {
    jest.spyOn(Date, "now").mockImplementation(() => 1000);
    const invocationId = "TestId";
    const requests = [
      generateOrganisationRequest("", "", olderTestDate.toISOString()),
      generateOrganisationRequest("", "", olderTestDate.toISOString()),
    ];
    const rejectionProperties = {
      status: -1,
      actioned_at: Date.now(),
      actioned_reason:
        "Automated task - Approvers did not action request within 3 months",
    };
    contextMock.prototype.invocationId = invocationId;
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests,
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 2,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(
      organisationsMock.prototype.updateOrganisationRequest,
    ).toHaveBeenCalledTimes(2);
    expect(
      organisationsMock.prototype.updateOrganisationRequest,
    ).toHaveBeenNthCalledWith(
      1,
      requests[0].id,
      rejectionProperties,
      invocationId,
    );
    expect(
      organisationsMock.prototype.updateOrganisationRequest,
    ).toHaveBeenNthCalledWith(
      2,
      requests[1].id,
      rejectionProperties,
      invocationId,
    );
  });

  it("it logs the correct number of successful, failed, and errored request rejections in a page", async () => {
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests: [
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
        ],
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 6,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    organisationsMock.prototype.updateOrganisationRequest
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error("Test Error"))
      .mockRejectedValueOnce(new Error("Test Error"));
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      `rejectOldOrganisationRequests: 3 successful, 1 failed, and 2 errored rejections for 6 organisation requests`,
    );
  });

  it("it logs unique errors from the updateOrganisationRequest call if there are any for a page", async () => {
    const message1 = "Test 1";
    const message2 = "Test 2";
    const message3 = "Test 3";
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests: [
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
        ],
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 6,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    organisationsMock.prototype.updateOrganisationRequest
      .mockRejectedValueOnce(new Error(message1))
      .mockRejectedValueOnce(new Error(message1))
      .mockRejectedValueOnce(new Error(message2))
      .mockRejectedValueOnce(new Error(message3))
      .mockRejectedValueOnce(new Error(message2))
      .mockResolvedValue(true);
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(contextMock.prototype.error).toHaveBeenCalledTimes(3);
    expect(contextMock.prototype.error).toHaveBeenCalledWith(
      `rejectOldOrganisationRequests: ${message1}`,
    );
    expect(contextMock.prototype.error).toHaveBeenCalledWith(
      `rejectOldOrganisationRequests: ${message2}`,
    );
    expect(contextMock.prototype.error).toHaveBeenCalledWith(
      `rejectOldOrganisationRequests: ${message3}`,
    );
  });

  it("it throws an error if the entire page errored (updateOrganisationRequest rejected for all requests)", async () => {
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests: [
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
        ],
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 2,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    organisationsMock.prototype.updateOrganisationRequest.mockRejectedValue(
      new Error(""),
    );

    await expect(
      rejectOldOrganisationRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(
      "rejectOldOrganisationRequests: All request rejections had an error, failing execution so it can retry.",
    );
  });

  it("it doesn't throw an error if the updateOrganisationRequest call doesn't throw for all requests in a page", async () => {
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests: [
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
        ],
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 2,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    organisationsMock.prototype.updateOrganisationRequest
      .mockRejectedValueOnce(new Error(""))
      .mockResolvedValue(true);

    await expect(
      rejectOldOrganisationRequests({} as Timer, new InvocationContext()),
    ).resolves.not.toThrow();
  });

  it("it doesn't attempt to send any audit logs/notifications or retrieve user data if none were successfully rejected", async () => {
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests: [
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
        ],
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 3,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    organisationsMock.prototype.updateOrganisationRequest.mockResolvedValue(
      false,
    );
    directoriesMock.prototype.getUsersByIds.mockResolvedValue([
      generateSafeUser("", "", 1),
    ]);
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalled();
    expect(contextMock.prototype.info).not.toHaveBeenCalledWith(
      "rejectOldOrganisationRequests: Sending audit messages for the 0 successfully rejected requests",
    );
    expect(contextMock.prototype.info).not.toHaveBeenCalledWith(
      "rejectOldOrganisationRequests: Retrieving user information for the 0 successfully rejected requests",
    );
    expect(auditLoggerMock.prototype.batchedLog).not.toHaveBeenCalled();
    expect(directoriesMock.prototype.getUsersByIds).not.toHaveBeenCalled();
    expect(
      notificationClientMock.prototype.sendAccessRequest,
    ).not.toHaveBeenCalled();
  });

  it("it logs the number of successful request rejections having audit messages sent, if some were successfully rejected", async () => {
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests: [
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
        ],
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 3,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    organisationsMock.prototype.updateOrganisationRequest
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      "rejectOldOrganisationRequests: Sending audit messages for the 2 successfully rejected requests",
    );
  });

  it("it throws an error if the audit logger throws an error when sending a message batch", async () => {
    const errorMessage = "Testing Audit Logger Send";
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests: [
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
        ],
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 1,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    auditLoggerMock.prototype.batchedLog.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(
      rejectOldOrganisationRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldOrganisationRequests: ${errorMessage}`);
  });

  it("it sends a batch of correct logs to the audit service bus for all the successful request rejections", async () => {
    const requests = [
      generateOrganisationRequest(
        "org-1",
        "user-1",
        olderTestDate.toISOString(),
      ),
      generateOrganisationRequest(
        "org-2",
        "user-1",
        olderTestDate.toISOString(),
      ),
      generateOrganisationRequest(
        "org-1",
        "user-2",
        olderTestDate.toISOString(),
      ),
    ];
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests,
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 3,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(auditLoggerMock.prototype.batchedLog).toHaveBeenCalled();
    expect(auditLoggerMock.prototype.batchedLog).toHaveBeenCalledWith(
      requests.map((request) => ({
        message: `Automated rejection of requests older than 3 months`,
        type: "approver",
        subType: "rejected-org",
        organisationid: request.org_id,
        meta: {
          editedUser: request.user_id,
          reason:
            "Automated task - Approvers did not action request within 3 months",
        },
      })),
    );
  });

  it("it logs the number of successful request rejections that could have notifications sent, if some were successfully rejected", async () => {
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests: [
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
        ],
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 5,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    organisationsMock.prototype.updateOrganisationRequest
      .mockRejectedValueOnce(new Error(""))
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      "rejectOldOrganisationRequests: Retrieving user information for the 3 successfully rejected requests",
    );
  });

  it("it throws an error if the attempt to retrieve user information for the successful rejections throws an error", async () => {
    const errorMessage = "Test Error";
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests: [
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
        ],
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 1,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    directoriesMock.prototype.getUsersByIds.mockRejectedValue(
      new Error(errorMessage),
    );

    await expect(
      rejectOldOrganisationRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldOrganisationRequests: ${errorMessage}`);
  });

  it("it attempts to retrieve user information for the distinct user IDs of the successful rejections with the invocation ID", async () => {
    const user1 = "user-1";
    const user2 = "user-2";
    const user3 = "user-3";
    const invocationId = "TestId";
    contextMock.prototype.invocationId = invocationId;
    const requests = [
      generateOrganisationRequest("", user1, olderTestDate.toISOString()),
      generateOrganisationRequest("", user2, olderTestDate.toISOString()),
      generateOrganisationRequest("", user3, olderTestDate.toISOString()),
      generateOrganisationRequest("", user3, olderTestDate.toISOString()),
      generateOrganisationRequest("", user2, olderTestDate.toISOString()),
    ];
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests,
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 5,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(directoriesMock.prototype.getUsersByIds).toHaveBeenCalled();
    expect(directoriesMock.prototype.getUsersByIds).toHaveBeenCalledWith(
      [user1, user2, user3],
      invocationId,
    );
  });

  it("it logs the correct number of rejections receiving notifications as they are linked to active users", async () => {
    const requests = [
      generateOrganisationRequest("", "user-1", olderTestDate.toISOString()),
      generateOrganisationRequest("", "user-2", olderTestDate.toISOString()),
      generateOrganisationRequest("", "user-3", olderTestDate.toISOString()),
      generateOrganisationRequest("", "user-4", olderTestDate.toISOString()),
    ];
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests,
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 4,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    directoriesMock.prototype.getUsersByIds.mockResolvedValue([
      generateSafeUser("user-1", "", 1),
      generateSafeUser("user-3", "", 0),
      generateSafeUser("user-4", "", 1),
    ]);
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      `rejectOldOrganisationRequests: Sending rejection emails for the 2 successfully rejected requests with active users`,
    );
  });

  it("it throws an error if the notifications client throws an error when sending a notification", async () => {
    const errorMessage = "Test Error";
    const requests = [
      generateOrganisationRequest("", "user-1", olderTestDate.toISOString()),
    ];
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests,
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 1,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    directoriesMock.prototype.getUsersByIds.mockResolvedValue([
      generateSafeUser("user-1", "", 1),
    ]);
    notificationClientMock.mockImplementation(() => ({
      sendAccessRequest: jest.fn(() => {
        throw new Error(errorMessage);
      }),
    }));

    await expect(
      rejectOldOrganisationRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldOrganisationRequests: ${errorMessage}`);
  });

  it("it doesn't send any notifications if none of the successful rejections are linked to active users", async () => {
    const requests = [
      generateOrganisationRequest("", "user-1", olderTestDate.toISOString()),
      generateOrganisationRequest("", "user-2", olderTestDate.toISOString()),
      generateOrganisationRequest("", "user-3", olderTestDate.toISOString()),
    ];
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests,
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 3,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    directoriesMock.prototype.getUsersByIds.mockResolvedValue([
      generateSafeUser("user-1", "", 0),
      generateSafeUser("user-3", "", 0),
    ]);
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(
      notificationClientMock.prototype.sendAccessRequest,
    ).not.toHaveBeenCalled();
    expect(contextMock.prototype.info).not.toHaveBeenCalledWith(
      `rejectOldOrganisationRequests: Sending rejection emails for the 0 successfully rejected requests with active users`,
    );
  });

  it("it sends a notification with the correct arguments for all the successful rejections that are linked to active users", async () => {
    const additionalTestDate = new Date();
    additionalTestDate.setMonth(additionalTestDate.getMonth() - 6);
    const requests = [
      generateOrganisationRequest("", "user-1", olderTestDate.toISOString(), {
        org_name: "Org 1",
      }),
      generateOrganisationRequest(
        "",
        "user-1",
        additionalTestDate.toISOString(),
        { org_name: "Org 2" },
      ),
      generateOrganisationRequest("", "user-2", olderTestDate.toISOString(), {
        org_name: "Org 3",
      }),
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
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests,
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 4,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    directoriesMock.prototype.getUsersByIds.mockResolvedValue(users);
    const sendAccessRequest = jest.fn();
    notificationClientMock.mockImplementation(() => ({
      sendAccessRequest,
    }));
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(sendAccessRequest).toHaveBeenCalledTimes(3);
    expect(sendAccessRequest).toHaveBeenNthCalledWith(
      1,
      users[0].email,
      `${users[0].given_name} ${users[0].family_name}`,
      requests[0].org_name,
      false,
      `The approver(s) at the organisation haven't taken any action on your request, which was made on ${olderTestDate.toLocaleDateString()}.`,
    );
    expect(sendAccessRequest).toHaveBeenNthCalledWith(
      2,
      users[0].email,
      `${users[0].given_name} ${users[0].family_name}`,
      requests[1].org_name,
      false,
      `The approver(s) at the organisation haven't taken any action on your request, which was made on ${additionalTestDate.toLocaleDateString()}.`,
    );
    expect(sendAccessRequest).toHaveBeenNthCalledWith(
      3,
      users[1].email,
      `${users[1].given_name} ${users[1].family_name}`,
      requests[2].org_name,
      false,
      `The approver(s) at the organisation haven't taken any action on your request, which was made on ${olderTestDate.toLocaleDateString()}.`,
    );
  });

  it("it throws an error if the following page retrieval of overdue organisation requests throws an error", async () => {
    const errorMessage = "Test Error";
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests: [
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
        ],
        page: 1,
        totalNumberOfPages: 1,
        totalNumberOfRecords: 2,
      })
      .mockRejectedValueOnce(new Error(errorMessage));

    await expect(
      rejectOldOrganisationRequests({} as Timer, new InvocationContext()),
    ).rejects.toThrow(`rejectOldOrganisationRequests: ${errorMessage}`);
  });

  it("it attempts to retrieve the following pages of overdue organisation requests with the invocation ID", async () => {
    const invocationId = "TestId";
    contextMock.prototype.invocationId = invocationId;
    organisationsMock.prototype.getOrganisationRequestPage
      .mockResolvedValueOnce({
        requests: [
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
          generateOrganisationRequest("", "", olderTestDate.toISOString()),
        ],
        page: 1,
        totalNumberOfPages: 2,
        totalNumberOfRecords: 2,
      })
      .mockResolvedValue(blankOrganisationRequestPage);
    await rejectOldOrganisationRequests({} as Timer, new InvocationContext());

    expect(
      organisationsMock.prototype.getOrganisationRequestPage,
    ).toHaveBeenCalledTimes(2);
    expect(
      organisationsMock.prototype.getOrganisationRequestPage,
    ).toHaveBeenLastCalledWith(2, invocationId, [2]);
  });
});
