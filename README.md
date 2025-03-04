# login.dfe.automated-tasks

Automated tasks run on schedules or triggered manually to carry out BAU activities for DfE Sign-in.

- [login.dfe.automated-tasks](#logindfeautomated-tasks)
  - [DevOps Requirements](#devops-requirements)
  - [What is that weird prepare code in package.json?](#what-is-that-weird-prepare-code-in-packagejson)
  - [Automated Tasks](#automated-tasks)
  - [Local Debugging](#local-debugging)
    - [First time setup](#first-time-setup)
    - [Running any functions locally](#running-any-functions-locally)
  - [Adding New Azure Functions](#adding-new-azure-functions)
  - [Adding New Database Connections](#adding-new-database-connections)
  - [Adding New DSi Internal API Connections](#adding-new-dsi-internal-api-connections)

## DevOps Requirements

- The app service for this repo, and the pipeline should be in the backend tier, as it's an automated function that isn't used by anything else.
- In `DevOps/pipeline/azure-pipeline.yml` make sure that `buildFlow: true` is set for the `pipeline/buildAzureFunctions.yml@devopsTemplates` template, this ensures the TypeScript code is transpiled into JavaScript so it will function correctly.

## What is that weird prepare code in package.json?

The `@azure/service-bus` package uses a package names `long` which as of writing hasn't been updated since April 16th 2023. The `long` package does not like the following newer compiler options for typescript `"module": "Node16"` and `"moduleResolution": "node16"`, due to the way it exports one of its types. These compiler options (at least its currently matching option `nodenext`) are recommended by the [TypeScript documentation](https://www.typescriptlang.org/tsconfig/#module) "You very likely want `"nodenext"` for modern Node.js projects". Without it, some of our other dependencies fail to compile and the last thing we want to do is turn off dependency checking with TypeScript, as we lose some type safety protection.

The `long` package has issues raised about this problem, [this one](https://github.com/dcodeIO/long.js/issues/125) in July 2023 found the problem and PRs have been made to fix it but never merged. I also personally tried:

- Turning the compiler options back to their defaults, and attempting to see if other options fixed issues.
- Installing `long` as a dependency.
- Installing `@types/long` type definitions with/without the `long` package installed.
- Attempting to overwrite the types manually with a mocked types file copied from the package (another workaround listed) but as it's a dependency of `@azure/service-bus` not us directly I couldn't get it working.

So we are left with two choices, turn off the dependency checking in TypeScript, or use the workaround in the [GitHub issue](https://github.com/dcodeIO/long.js/issues/125#issuecomment-1897638682) which copies the correct version of the type definitions to replace the broken one. Ideally we want to turn off dependency checking as a last resort, so I slightly modified the workaround to only copy the file if both the original file and the destination exists:

```js
const fs = require('node:fs');
if (fs.existsSync('./node_modules/@azure/service-bus/node_modules/long/index.d.ts') && fs.existsSync('./node_modules/@azure/service-bus/node_modules/long/umd/index.d.ts')) {
  fs.copyFileSync('./node_modules/@azure/service-bus/node_modules/long/index.d.ts', './node_modules/@azure/service-bus/node_modules/long/umd/index.d.ts');
}
```

**NOTE:** I am not overly happy with this solution, but as the fix PRs in the package haven't been merged, and there have been no updates since 2023, I believe this is the best way until the `@azure/service-bus` package does a fix on their imported version, or the original `long` package is fixed.

## Automated Tasks

- `deactivateUnusedAccounts`:
  - Default Timer: Midnight on the first day of every month.
  - Description: Deactivates and creates audit records for any users whose last login is older than 2 years from the current run date, or if their account was created over 2 years from the current run date and they never logged in since verifying their email address.
- `removeGeneratedTestAccounts`:
  - Default timer: Midnight on every Monday.
  - Description: Removes any records for users/invitations generated automatically by the test team as part of their regression testing.
- `removeUnresolvedInvitations`:
  - Default Timer: Midnight on the first day of every month.
  - Description: Removes invitations that have not been completed in the past 3 months, where no user is linked to them (manually in the DB) and they are not deactivated.

## Local Debugging

To ease local running/debugging of these functions, please install the recommended VSCode extensions:

- [Azure Functions](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions)
- [Azurite](https://marketplace.visualstudio.com/items?itemName=Azurite.azurite) (alternatively, you can download [Azurite via npm](https://learn.microsoft.com/en-gb/azure/storage/common/storage-use-azurite?tabs=npm%2Cblob-storage) but the instructions below are for the VSCode extension)

### First time setup

1. Open the command palette (`F1` or `ctrl + shift + p`) in VSCode and run the "Azure Functions: Install or Update Azure Functions Core Tools" command to install the tools required to run the function locally.
2. Create a `local.settings.json` file in the root directory (ignored by git) with the following default settings:
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureFunctionsJobHost__logging__logLevel__default": "Trace",
    "DEBUG": "true",
    "TIMER_DEACTIVATE_UNUSED_ACCOUNTS": "0 0 0 1 * *",
    "TIMER_REMOVE_GENERATED_TEST_ACCOUNTS": "0 0 0 * * 1",
    "TIMER_REMOVE_UNRESOLVED_INVITATIONS": "0 0 0 1 * *",
    "DATABASE_DIRECTORIES_HOST": "",
    "DATABASE_DIRECTORIES_NAME": "",
    "DATABASE_DIRECTORIES_USERNAME": "",
    "DATABASE_DIRECTORIES_PASSWORD": "",
    "DATABASE_ORGANISATIONS_HOST": "",
    "DATABASE_ORGANISATIONS_NAME": "",
    "DATABASE_ORGANISATIONS_USERNAME": "",
    "DATABASE_ORGANISATIONS_PASSWORD": "",
    "API_INTERNAL_ACCESS_HOST": "",
    "API_INTERNAL_DIRECTORIES_HOST": "",
    "API_INTERNAL_ORGANISATIONS_HOST": "",
    "API_INTERNAL_TENANT": "",
    "API_INTERNAL_AUTHORITY_HOST": "",
    "API_INTERNAL_CLIENT_ID": "",
    "API_INTERNAL_CLIENT_SECRET": "",
    "API_INTERNAL_RESOURCE": "",
    "AUDIT_CONNECTION_STRING": "",
    "AUDIT_TOPIC_NAME": "audit"
  },
  "ConnectionStrings": {}
}
```

### Running any functions locally

1. Adjust the `local.settings.json` file to fit the environment you are debugging against using the table below these steps.
2. Run the pipeline to whitelist your IP for the dev app services (or manually add yourself to the app service you need), and go to the `Networking` settings for the service bus of the environment to add your IP address there.
3. Start the Azurite storage emulator using the "Azurite: Start" command from the command palette (`F1` or `ctrl + shift + p`) as the functions need somewhere to write their state that mimics Azure's storage when deployed.
4. Open the "Run and Debug" menu in VSCode, select "Attach to Node functions" if it isn't selected by default, and click the start debugging button, this does the following:
    - Start Typescript's watch mode to update the functions when changes are made.
    - Start the local Azure Functions runtime, showing their output in the terminal. The functions will appear in the Azure tab of your VSCode, under "Workspace > Local Project > Functions" and allows you to manually kick off a run there by right clicking the function and choosing "Execute Function Now".
5. Do your testing/debugging!
6. Once you're finished, you can stop the functions by either alt-clicking the detach/disconnect button in the debug bar that floats on your screen (or click the little drop-down beside it and click "Stop") or terminating the running terminals in VSCode and detaching the debugger.
7. To stop Azurite, run "Azurite: Close" from the command palette. The files generated by Azurite are in the `.gitignore` file but if you would like to clean them, run "Azurite: Clean" which will attempt to clear the files it generated.

| Setting | Description | How to update | Default value |
|   ---   |     ---     |      ---      |      ---      |
| AzureFunctionsJobHost__logging__logLevel__default | Sets the log level for the locally running functions, to set what is shown/hidden in the debug console. | Change to one of the following values: `Trace`, `Debug`, `Information`, `Warning`, `Error`, `Critical`. | `Trace` |
| DEBUG | Turns on additional logging for sequelize, lowers the log level for MSAL to info instead of error, and connects to service bus via Websockets to get around the VPN all to assist with debugging issues. | Simple toggle, change to `false` to disable additional logging. | `true` |
| TIMER_DEACTIVATE_UNUSED_ACCOUNTS | The NCronTab expression that sets the schedule for the `deactivateUnusedAccounts` function (`./src/functions/deactivateUnusedAccounts`). | Read the [documentation on NCrontab formatting](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer?tabs=python-v2%2Cisolated-process%2Cnodejs-v4&pivots=programming-language-typescript#ncrontab-expressions) and use a [tester](https://ncrontab.swimburger.net/) to verify your expression runs as you'd expect. | `0 0 0 1 * *` Runs at 12AM UTC on the first day of every month. |
| TIMER_REMOVE_GENERATED_TEST_ACCOUNTS | The NCronTab expression that sets the schedule for the `removeGeneratedTestAccounts` function (`./src/functions/removeGeneratedTestAccounts`). | Read the [documentation on NCrontab formatting](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer?tabs=python-v2%2Cisolated-process%2Cnodejs-v4&pivots=programming-language-typescript#ncrontab-expressions) and use a [tester](https://ncrontab.swimburger.net/) to verify your expression runs as you'd expect. | `0 0 0 * * 1` Runs at 12AM UTC on every Monday. |
| TIMER_REMOVE_UNRESOLVED_INVITATIONS | The NCronTab expression that sets the schedule for the `removeUnresolvedInvitations` function (`./src/functions/removeUnresolvedInvitations`). | Read the [documentation on NCrontab formatting](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer?tabs=python-v2%2Cisolated-process%2Cnodejs-v4&pivots=programming-language-typescript#ncrontab-expressions) and use a [tester](https://ncrontab.swimburger.net/) to verify your expression runs as you'd expect. | `0 0 0 1 * *` Runs at 12AM UTC on the first day of every month. |
| DATABASE_DIRECTORIES_HOST | The directories database hostname/URL. | Retrieve from KeyVault or other database connections. | `""`
| DATABASE_DIRECTORIES_NAME | The directories database name | Retrieve from KeyVault or other database connections. | `""`
| DATABASE_DIRECTORIES_USERNAME | SQL username for connecting to the directories database. | Use your own username or retrieve from KeyVault. | `""`
| DATABASE_DIRECTORIES_PASSWORD | SQL password for connecting to the directories database. | Use your own password or retrieve from KeyVault. | `""`
| DATABASE_ORGANISATIONS_HOST | The organisations database hostname/URL. | Retrieve from KeyVault or other database connections. | `""`
| DATABASE_ORGANISATIONS_NAME | The organisations database name | Retrieve from KeyVault or other database connections. | `""`
| DATABASE_ORGANISATIONS_USERNAME | SQL username for connecting to the organisations database. | Use your own username or retrieve from KeyVault. | `""`
| DATABASE_ORGANISATIONS_PASSWORD | SQL password for connecting to the organisations database. | Use your own password or retrieve from KeyVault. | `""`
| API_INTERNAL_ACCESS_HOST | Host URL for the internal access API. | Retrieve from KeyVault or the "Domains" section of the app service's "Overview" page in the Azure portal. | `""`
| API_INTERNAL_DIRECTORIES_HOST | Host URL for the internal directories API. | Retrieve from KeyVault or the "Domains" section of the app service's "Overview" page in the Azure portal. | `""`
| API_INTERNAL_ORGANISATIONS_HOST | Host URL for the internal organisations API. | Retrieve from KeyVault or the "Domains" section of the app service's "Overview" page in the Azure portal. | `""`
| API_INTERNAL_TENANT | Tenant ID of the internal API tenant. | Retrieve from KeyVault. | `""`
| API_INTERNAL_AUTHORITY_HOST | Authority host URL of the internal API tenant. | Retrieve from KeyVault. | `""`
| API_INTERNAL_CLIENT_ID | Client ID of the internal API tenant. | Retrieve from KeyVault. | `""`
| API_INTERNAL_CLIENT_SECRET | Client secret of the internal API tenant. | Retrieve from KeyVault. | `""`
| API_INTERNAL_RESOURCE | Resource ID of the internal API tenant. | Retrieve from KeyVault. | `""`
| AUDIT_CONNECTION_STRING | Connection string of the environment's shared service bus. | Retrieve from KeyVault or the service bus' "Shared access policies" page in the Azure portal. | `""`
| AUDIT_TOPIC_NAME | Service bus audit topic name. | Retrieve from KeyVault or the service bus' "Overview" page in the Azure portal. | `"audit"`

## Adding New Azure Functions

In the following steps we'll create a new handler for our new timer trigger  `functionName` Azure function, and register it with our function app.

1. Create a new TypeScript file in `src/functions` to house the handler for the Azure function, similar to the one below, and export it.

```js
import { InvocationContext, Timer } from "@azure/functions";

export async function functionName(_: Timer, context: InvocationContext): Promise<void> {
  context.log(`functionName function processed invocation: ${context.invocationId}`);
};
```

2. In `src/index.ts`, add a new definition for the function by calling `app.TRIGGER`, in our case of a timer it'll be `app.timer`, and passing the necessary information:
    - The first argument is the name you want the function to have in the Azure Portal.
    - The second argument will depend on the type of trigger but for timer triggers it needs the following options:
      - Schedule: An [NCrontab expression](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer?tabs=python-v2%2Cisolated-process%2Cnodejs-v4&pivots=programming-language-typescript#ncrontab-expressions) or an environment variable name between `%` symbols to retrieve the schedule from.
      - Handler: The function that will be executed when the scheduled timer is triggered.
      - Retry: The retry options, as defined in the [Microsoft documentation](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-error-pages?tabs=fixed-delay%2Cisolated-process%2Cnode-v4%2Cpython-v2&pivots=programming-language-typescript#retry-examples) for how the function should retry in case an error is thrown. Other types of trigger may need to be configured in the `host.json` file.

```js
app.timer("functionName", {
  schedule: "%TIMER_FUNCTION_NAME%",
  handler: functionName,
  retry: {
    strategy: "exponentialBackoff",
    maximumInterval: 300000,
    minimumInterval: 30000,
    maxRetryCount: 5,
  },
});
```

## Adding New Database Connections

1. Add an additional value to the `DatabaseName` enum within `src/infrastructure/database/common/connection.ts` e.g. `Foo = "foo"`.
2. Add app settings/environment variables to the app and your `local.settings.json` named using the database name in capitals, the following is using the `"foo"` example:
   - `DATABASE_FOO_HOST`
   - `DATABASE_FOO_NAME`
   - `DATABASE_FOO_USERNAME`
   - `DATABASE_FOO_PASSWORD`
3. Update the blank `local.settings.json` in step 2 of the ["First time setup"](#first-time-setup) section above.
4. Add descriptions to the table in step 1 of the ["Running any functions locally"](#running-any-functions-locally) section above.

## Adding New DSi Internal API Connections

1. Add an additional value to the `ApiName` enum within `src/infrastructure/api/dsiInternal/DsiInternalApiClient.ts` e.g. `Foo = "foo"`.
2. Add an app setting/environment variable for the API's URL to the app and your `local.settings.json` file named using the API name in capitals, the following is using the `"foo"` example:
   - `API_INTERNAL_FOO_HOST`
3. Update the blank `local.settings.json` in step 2 of the ["First time setup"](#first-time-setup) section above.
4. Add a description to the table in step 1 of the ["Running any functions locally"](#running-any-functions-locally) section above.
