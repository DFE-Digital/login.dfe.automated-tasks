import { ServiceBusClient, ServiceBusMessage } from "@azure/service-bus";
import { WebSocket } from "ws";
import { checkEnv } from "./utils";

/**
 * Available audit levels to accompany audit messages.
 */
export enum AuditLevel {
  Debug = "debug",
  Info = "info",
  Audit = "audit",
  Warning = "warning",
  Error = "error",
};

/**
 * Audit log fields.
 */
export interface AuditLog {
  level?: AuditLevel,
  message: string,
  application?: string,
  env?: string,
  type: string,
  subType?: string,
  userId?: string,
  organisationid?: string,
  meta?: Record<string, object | number | string>,
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
    checkEnv(["AUDIT_CONNECTION_STRING", "AUDIT_TOPIC_NAME"], "audit service bus");

    const options = (process.env.DEBUG?.toLowerCase() === "true") ? {
      webSocketOptions: {
        webSocket: WebSocket,
      },
    } : {};

    this.serviceBus = new ServiceBusClient(process.env.AUDIT_CONNECTION_STRING, options);
  };

  /**
   * Adds default values for optional audit log fields and turn into the service bus format.
   *
   * @param record - An audit log record ({@link AuditLog}).
   * @returns A formatted audit log message ({@link ServiceBusMessage}).
   */
  private formatLog(record: AuditLog): ServiceBusMessage {
    const formattedRecord = { ...record };

    if (!formattedRecord.level) {
      formattedRecord.level = AuditLevel.Audit;
    }

    if (!formattedRecord.application) {
      formattedRecord.application = "automated-tasks";
    }

    if (!formattedRecord.env) {
      formattedRecord.env = "azure";
    }

    return {
      body: JSON.stringify([JSON.stringify(formattedRecord)]),
    };
  };

  /**
   * Logs multiple records in batches to the service bus so it can go into the DSi audit tables.
   *
   * @param records - An array of audit log records ({@link AuditLog}) to be batch sent to the database.
   *
   * @throws Error if the service bus connection fails, or the message batch fails to send.
   */
  async batchedLog(records: AuditLog[]): Promise<void> {
    const batchSize = 100; // Azure service bus can send a max of 100 messages per batch.
    const sender = this.serviceBus.createSender(process.env.AUDIT_TOPIC_NAME);

    for (let index = 0; index < records.length; index += batchSize) {
      const batch = records.slice(index, index + batchSize);

      try {
        await sender.sendMessages(batch.map(record => this.formatLog(record)));
      } catch (error) {
        throw new Error(`Audit service bus message failed to send with error "${error.message}"`);
      }
    }

    await sender.close();
  };

  /**
   * Logs a record to the service bus so it can go into the DSi audit tables.
   *
   * @param record - An audit log record ({@link AuditLog}) to be put into the database.
   *
   * @throws Error if the service bus connection fails, or the message fails to send.
   */
  async log(record: AuditLog): Promise<void> {
    const sender = this.serviceBus.createSender(process.env.AUDIT_TOPIC_NAME);

    try {
      await sender.sendMessages(this.formatLog(record));
    } catch (error) {
      throw new Error(`Audit service bus message failed to send with error "${error.message}"`);
    }

    await sender.close();
  };
};
