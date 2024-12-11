import assert from "assert";
import { ServiceBusClient } from "@azure/service-bus";
import { WebSocket } from "ws";

/**
 * Audit log fields.
 */
export interface AuditLog {
  level?: string,
  message: string,
  application?: string,
  env?: string,
  type: string,
  subType?: string,
  userId?: string,
  organisationid?: string,
  meta?: Record<string, any>,
};

/**
 * A logger for auditing messages to the DSi audit tables via a service bus.
 */
export class AuditLogger {
  private serviceBus: ServiceBusClient;

  /**
   * Instantiates a logger {@link AuditLogger} to log records to the DSi audit tables.
   */
  constructor() {
    ["AUDIT_CONNECTION_STRING", "AUDIT_TOPIC_NAME"].forEach((requiredOption) => {
      const envValue = process.env[requiredOption] ?? "";
      assert(envValue.length > 0, `${requiredOption} is missing, cannot create audit service bus connection!`);
    });

    const options = (process.env.DEBUG?.toLowerCase() === "true") ? {
      webSocketOptions: {
        webSocket: WebSocket,
      },
    } : {};

    this.serviceBus = new ServiceBusClient(process.env.AUDIT_CONNECTION_STRING, options);
  };

  /**
   * Logs a record to the service bus so it can go into the DSi audit tables.
   *
   * @param record - An audit log {@link AuditLog} record to be put into the database.
   */
  async log(record: AuditLog): Promise<void> {
    const sender = this.serviceBus.createSender(process.env.AUDIT_TOPIC_NAME);

    if (!record.level) {
      record.level = "audit";
    }

    if (!record.application) {
      record.application = "automated-tasks";
    }

    if (!record.env) {
      record.env = "azure";
    }

    try {
      await sender.sendMessages({
        body: JSON.stringify([JSON.stringify(record)]),
      });
    } catch (error) {
      throw new Error(`Audit service bus message failed to send with error "${error.message}"`);
    }

    await sender.close();
  };
};
