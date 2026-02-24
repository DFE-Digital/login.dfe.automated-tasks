import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import { checkEnv } from "../../utils";

/**
 * Configures the Graph API client to authenticate for Entra with msal-node which we use across our applications.
 */
export function createEntraGraphClient(): Client {
  checkEnv(
    [
      "ENTRA_CLIENT_ID",
      "ENTRA_CLIENT_SECRET",
      "ENTRA_CLOUD_INSTANCE",
      "ENTRA_TENANT_ID",
    ],
    "Entra Graph API",
  );

  const application = new ConfidentialClientApplication({
    auth: {
      authority: `${process.env.ENTRA_CLOUD_INSTANCE}/${process.env.ENTRA_TENANT_ID}`,
      knownAuthorities: [new URL(process.env.ENTRA_CLOUD_INSTANCE).host],
      clientId: process.env.ENTRA_CLIENT_ID,
      clientSecret: process.env.ENTRA_CLIENT_SECRET,
    },
    system: {
      loggerOptions: {
        loggerCallback(loglevel, message) {
          if (loglevel === LogLevel.Error) {
            console.error(message);
          } else {
            console.log(message);
          }
        },
        piiLoggingEnabled: false,
        logLevel: LogLevel.Error,
      },
    },
  });

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () =>
        application
          .acquireTokenByClientCredential({
            scopes: ["https://graph.microsoft.com/.default"],
          })
          .then((result) => result.accessToken),
    },
  });
}
