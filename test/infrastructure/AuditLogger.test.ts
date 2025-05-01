import { ServiceBusClient } from "@azure/service-bus";
import { AuditLevel, AuditLogger } from "../../src/infrastructure/AuditLogger";
import WebSocket from "ws";
import { checkEnv } from "../../src/infrastructure/utils";

jest.mock("@azure/service-bus");
jest.mock("../../src/infrastructure/utils");

describe("Service bus audit logger", () => {
  const originalEnv = { ...process.env };
  const serviceBusClient = jest.mocked(ServiceBusClient);
  const checkEnvMock = jest.mocked(checkEnv);

  beforeEach(() => {
    process.env = {};
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("When creating a service bus audit logger", () => {
    it("it will call checkEnv with the required environment variables and name for connecting to the service bus", () => {
      new AuditLogger();

      expect(checkEnvMock).toHaveBeenCalled();
      expect(checkEnvMock).toHaveBeenCalledWith(
        ["AUDIT_CONNECTION_STRING", "AUDIT_TOPIC_NAME"],
        "audit service bus",
      );
    });

    it("it will throw an error if checkEnv throws an error when any required environment variables are not set", () => {
      const errorMessage = "Test Error";
      checkEnvMock.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      expect(() => new AuditLogger()).toThrow(errorMessage);
    });

    it("it will create a ServiceBusClient using the connection string environment variable", () => {
      const connectionString = "testing1234";
      process.env.AUDIT_CONNECTION_STRING = connectionString;
      new AuditLogger();

      expect(serviceBusClient).toHaveBeenCalled();
      expect(serviceBusClient.mock.calls[0][0]).toEqual(connectionString);
    });

    it.each([
      [
        {
          webSocketOptions: {
            webSocket: WebSocket,
          },
        },
        "true",
      ],
      [{}, "false"],
      [{}, ""],
      [{}, undefined],
    ])(
      "it will create a ServiceBusClient with options (%p) when process.env.DEBUG is set to %p",
      (options, debug) => {
        process.env.DEBUG = debug;
        new AuditLogger();

        expect(serviceBusClient).toHaveBeenCalled();
        expect(serviceBusClient.mock.calls[0][1]).toEqual(options);
      },
    );
  });

  describe("Logging functions", () => {
    const sendMessages = jest.fn();
    const close = jest.fn();
    const createSender = jest.fn();
    const minimumLog = {
      message: "Test Message",
      type: "Test Type",
    };
    let auditLogger: AuditLogger;

    beforeEach(() => {
      serviceBusClient.mockImplementation(
        () =>
          ({
            createSender: createSender.mockImplementation(() => ({
              sendMessages,
              close,
            })),
          }) as unknown as ServiceBusClient,
      );
      auditLogger = new AuditLogger();
    });

    describe("batchedLog", () => {
      it("it creates a sender using the topic name environment variable", async () => {
        const topicName = "testingTopic";
        process.env.AUDIT_TOPIC_NAME = topicName;
        await auditLogger.batchedLog([minimumLog]);

        expect(createSender).toHaveBeenCalled();
        expect(createSender).toHaveBeenCalledWith(topicName);
      });

      it("it sets each audit record's level to 'audit' if it is not set", async () => {
        const level = AuditLevel.Debug;
        const logs = [
          minimumLog,
          minimumLog,
          {
            ...minimumLog,
            level,
          },
        ];
        await auditLogger.batchedLog(logs);

        expect(sendMessages).toHaveBeenCalled();
        expect(
          JSON.parse(JSON.parse(sendMessages.mock.calls[0][0][0].body)[0]),
        ).toHaveProperty("level", "audit");
        expect(
          JSON.parse(JSON.parse(sendMessages.mock.calls[0][0][1].body)[0]),
        ).toHaveProperty("level", "audit");
        expect(
          JSON.parse(JSON.parse(sendMessages.mock.calls[0][0][2].body)[0]),
        ).toHaveProperty("level", level);
      });

      it("it sets each audit record's application to 'automated-tasks' if it is not set", async () => {
        const application = "testApplication";
        const logs = [
          minimumLog,
          minimumLog,
          {
            ...minimumLog,
            application,
          },
        ];
        await auditLogger.batchedLog(logs);

        expect(sendMessages).toHaveBeenCalled();
        expect(
          JSON.parse(JSON.parse(sendMessages.mock.calls[0][0][0].body)[0]),
        ).toHaveProperty("application", "automated-tasks");
        expect(
          JSON.parse(JSON.parse(sendMessages.mock.calls[0][0][1].body)[0]),
        ).toHaveProperty("application", "automated-tasks");
        expect(
          JSON.parse(JSON.parse(sendMessages.mock.calls[0][0][2].body)[0]),
        ).toHaveProperty("application", application);
      });

      it("it sets each audit record's env to 'azure' if it is not set", async () => {
        const env = "testing";
        const logs = [
          minimumLog,
          minimumLog,
          {
            ...minimumLog,
            env,
          },
        ];
        await auditLogger.batchedLog(logs);

        expect(sendMessages).toHaveBeenCalled();
        expect(
          JSON.parse(JSON.parse(sendMessages.mock.calls[0][0][0].body)[0]),
        ).toHaveProperty("env", "azure");
        expect(
          JSON.parse(JSON.parse(sendMessages.mock.calls[0][0][1].body)[0]),
        ).toHaveProperty("env", "azure");
        expect(
          JSON.parse(JSON.parse(sendMessages.mock.calls[0][0][2].body)[0]),
        ).toHaveProperty("env", env);
      });

      it("it sends the JSON stringified array of the stringified body for each message to the service bus topic", async () => {
        const fullLog = {
          level: AuditLevel.Audit,
          message: "test",
          application: "test",
          env: "test",
          type: "test",
          subType: "test",
          userId: "test",
          organisationid: "test",
          meta: {
            test: "test",
          },
        };
        const message = {
          body: JSON.stringify([JSON.stringify(fullLog)]),
        };
        await auditLogger.batchedLog([fullLog, fullLog, fullLog]);

        expect(sendMessages).toHaveBeenCalled();
        expect(sendMessages).toHaveBeenCalledWith([message, message, message]);
      });

      it("it sends multiple batches of messages if the number of messages > largest batch size (100)", async () => {
        const messages = Array(305).fill(minimumLog);
        await auditLogger.batchedLog(messages);

        expect(sendMessages).toHaveBeenCalledTimes(4);
        expect(sendMessages.mock.calls[0][0].length).toEqual(100);
        expect(sendMessages.mock.calls[1][0].length).toEqual(100);
        expect(sendMessages.mock.calls[2][0].length).toEqual(100);
        expect(sendMessages.mock.calls[3][0].length).toEqual(5);
      });

      it("it throws an error if the service bus message fails to send", async () => {
        const errorMessage = "Test error message";
        sendMessages.mockImplementation(() => {
          throw new Error(errorMessage);
        });

        await expect(auditLogger.batchedLog([minimumLog])).rejects.toThrow(
          `Audit service bus message failed to send with error "${errorMessage}"`,
        );
      });

      it("it closes the sender after it has been used", async () => {
        await auditLogger.batchedLog([minimumLog]);

        expect(close).toHaveBeenCalled();
      });
    });

    describe("log", () => {
      it("it creates a sender using the topic name environment variable", async () => {
        const topicName = "testingTopic";
        process.env.AUDIT_TOPIC_NAME = topicName;
        await auditLogger.log(minimumLog);

        expect(createSender).toHaveBeenCalled();
        expect(createSender).toHaveBeenCalledWith(topicName);
      });

      it("it sets the audit record's level to 'audit' if it is not set", async () => {
        await auditLogger.log(minimumLog);

        expect(sendMessages).toHaveBeenCalled();
        expect(
          JSON.parse(JSON.parse(sendMessages.mock.calls[0][0].body)[0]),
        ).toHaveProperty("level", "audit");
      });

      it("it sets the audit record's application to 'automated-tasks' if it is not set", async () => {
        await auditLogger.log(minimumLog);

        expect(sendMessages).toHaveBeenCalled();
        expect(
          JSON.parse(JSON.parse(sendMessages.mock.calls[0][0].body)[0]),
        ).toHaveProperty("application", "automated-tasks");
      });

      it("it sets the audit record's env to 'azure' if it is not set", async () => {
        await auditLogger.log(minimumLog);

        expect(sendMessages).toHaveBeenCalled();
        expect(
          JSON.parse(JSON.parse(sendMessages.mock.calls[0][0].body)[0]),
        ).toHaveProperty("env", "azure");
      });

      it("it sends the JSON stringified array of the stringified body to the service bus topic", async () => {
        const fullLog = {
          level: AuditLevel.Audit,
          message: "test",
          application: "test",
          env: "test",
          type: "test",
          subType: "test",
          userId: "test",
          organisationid: "test",
          meta: {
            test: "test",
          },
        };
        await auditLogger.log(fullLog);

        expect(sendMessages).toHaveBeenCalled();
        expect(sendMessages).toHaveBeenCalledWith({
          body: JSON.stringify([JSON.stringify(fullLog)]),
        });
      });

      it("it throws an error if the service bus message fails to send", async () => {
        const errorMessage = "Test error message";
        sendMessages.mockImplementation(() => {
          throw new Error(errorMessage);
        });

        await expect(auditLogger.log(minimumLog)).rejects.toThrow(
          `Audit service bus message failed to send with error "${errorMessage}"`,
        );
      });

      it("it closes the sender after it has been used", async () => {
        await auditLogger.log(minimumLog);

        expect(close).toHaveBeenCalled();
      });
    });
  });
});
