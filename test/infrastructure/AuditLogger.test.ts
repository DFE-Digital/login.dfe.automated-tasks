import { ServiceBusClient } from "@azure/service-bus";
import { AuditLogger } from "../../src/infrastructure/AuditLogger";
import WebSocket from "ws";

jest.mock("@azure/service-bus", () => ({
  ServiceBusClient: jest.fn(() => ({
    createSender: jest.fn().mockImplementation(() => ({
      sendMessages: jest.fn(),
      close: jest.fn(),
    })),
  })),
}));

describe("Service bus audit logger", () => {
  const originalEnv = { ...process.env };
  const serviceBusClient = ServiceBusClient as jest.MockedClass<typeof ServiceBusClient>;

  beforeEach(() => {
    process.env = {
      AUDIT_CONNECTION_STRING: "Testing",
      AUDIT_TOPIC_NAME: "Testing",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("When creating a service bus audit logger", () => {
    it.each([
      "AUDIT_CONNECTION_STRING",
      "AUDIT_TOPIC_NAME",
    ])("it will throw an error if any required auth environment variables are not set (%p)", (variable) => {
      delete process.env[variable];

      expect(() => new AuditLogger()).toThrow(`${variable} is missing, cannot create audit service bus connection!`);
    });

    it("it will create a ServiceBusClient using the connection string environment variable", () => {
      const connectionString = "testing1234";
      process.env.AUDIT_CONNECTION_STRING = connectionString;
      new AuditLogger();

      expect(serviceBusClient).toHaveBeenCalled();
      expect(serviceBusClient.mock.calls[0][0]).toEqual(connectionString);
    });

    it.each([
      [{
        webSocketOptions: {
          webSocket: WebSocket,
        }
      }, "true"],
      [{}, "false"],
      [{}, ""],
      [{}, undefined],
    ])("it will create a ServiceBusClient with options (%p) when process.env.DEBUG is set to %p", (options, debug) => {
      process.env.DEBUG = debug;
      new AuditLogger();

      expect(serviceBusClient).toHaveBeenCalled();
      expect(serviceBusClient.mock.calls[0][1]).toEqual(options);
    });
  });

  describe("log", () => {
    const sendMessages = jest.fn();
    const close = jest.fn();
    const createSender = jest.fn();
    const minimumLog = {
      message: "Test Message",
      type: "Test Type"
    };
    let auditLogger: AuditLogger;

    beforeEach(() => {
      serviceBusClient.mockImplementation(() => ({
        createSender: createSender.mockImplementation(() => ({
          sendMessages,
          close,
        })),
      }) as unknown as ServiceBusClient);
      auditLogger = new AuditLogger();
    });

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
      expect(JSON.parse(JSON.parse(sendMessages.mock.calls[0][0].body)[0])).toHaveProperty("level", "audit");
    });

    it("it sets the audit record's application to 'automated-tasks' if it is not set", async () => {
      await auditLogger.log(minimumLog);

      expect(sendMessages).toHaveBeenCalled();
      expect(JSON.parse(JSON.parse(sendMessages.mock.calls[0][0].body)[0])).toHaveProperty("application", "automated-tasks");
    });

    it("it sets the audit record's env to 'azure' if it is not set", async () => {
      await auditLogger.log(minimumLog);

      expect(sendMessages).toHaveBeenCalled();
      expect(JSON.parse(JSON.parse(sendMessages.mock.calls[0][0].body)[0])).toHaveProperty("env", "azure");
    });

    it("it sends the JSON stringified array of the stringified body to the service bus topic", async () => {
      const fullLog = {
        level: "test",
        message: "test",
        application: "test",
        env: "test",
        type: "test",
        subType: "test",
        userId: "test",
        organisationid: "test",
        meta: {
          test: "test"
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

      expect(auditLogger.log(minimumLog)).rejects.toThrow(
        `Audit service bus message failed to send with error "${errorMessage}"`
      );
    });

    it("it closes the sender after it has been used", async () => {
      await auditLogger.log(minimumLog);

      expect(close).toHaveBeenCalled();
    });
  });
});
