declare module "login.dfe.jobs-client" {
  export class NotificationClient {
    constructor(options: { connectionString: string });

    sendAccessRequest(
      email: string,
      name: string,
      orgName: string,
      approved: boolean,
      reason: string,
    ): Promise<void>;
  }
}
