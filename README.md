# login.dfe.automated-tasks

[![Build Status](https://dfe-ssp.visualstudio.com/S141-Dfe-Signin/_apis/build/status%2FBackend%20tier%2Flogin.dfe.automated-tasks?repoName=DFE-Digital%2Flogin.dfe.automated-tasks&branchName=main)](https://dfe-ssp.visualstudio.com/S141-Dfe-Signin/_build/latest?definitionId=3244&repoName=DFE-Digital%2Flogin.dfe.automated-tasks&branchName=main)

## Overview

Automated tasks run on schedules or triggered manually to carry out BAU activities for DfE Sign-in.

This is an Azure Functions application built with TypeScript that runs scheduled maintenance tasks for the DfE Sign-in platform. Common tasks include deactivating unused accounts, rejecting old organisation requests, cleaning up test data, and managing unresolved invitations.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Visual Studio Code** (recommended)
- **Git**

For development and testing, the following VSCode extensions are recommended:

- [Azure Functions](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions)
- [Azurite](https://marketplace.visualstudio.com/items?itemName=Azurite.azurite) (Azure Storage emulator for local development)
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Architecture Overview

This application is structured as follows:

- **Functions** (`src/functions/`): Individual Azure Functions that execute scheduled tasks
- **Infrastructure** (`src/infrastructure/`): Shared services including database connections, API clients, and audit logging
- **Database Layer** (`src/infrastructure/database/`): Sequelize models and utilities for interacting with the directories and organisations databases
- **API Layer** (`src/infrastructure/api/`): Clients for communicating with internal DSi APIs using MSAL authentication
- **Utilities** (`src/functions/utils/`, `src/infrastructure/utils/`): Shared helper functions and validation

Each function is registered in `src/index.ts` and configured with:
- A schedule (NCronTab expression)
- Retry strategy for error handling
- Integration with audit logging for tracking actions


- [login.dfe.automated-tasks](#logindfeautomated-tasks)
  - [Overview](#overview)
  - [Prerequisites](#prerequisites)
  - [Architecture Overview](#architecture-overview)
  - [DevOps Requirements](#devops-requirements)
  - [Automated Tasks](#automated-tasks)
  - [Local Debugging](#local-debugging)
    - [First time setup](#first-time-setup)
    - [Running any functions locally](#running-any-functions-locally)
  - [Testing](#testing)
    - [Running Tests](#running-tests)
    - [Test Structure](#test-structure)
    - [Writing New Tests](#writing-new-tests)
    - [Test Coverage](#test-coverage)
  - [Code Quality](#code-quality)
    - [Common Commands](#common-commands)
    - [Pre-commit Hooks](#pre-commit-hooks)
  - [Common Development Tasks](#common-development-tasks)
    - [Modify an Existing Function](#modify-an-existing-function)
    - [Add a New Function](#add-a-new-function)
    - [Debug a Function Locally](#debug-a-function-locally)
    - [Check Database Queries](#check-database-queries)
    - [Add a New Database Connection](#add-a-new-database-connection)
    - [Add a New API Connection](#add-a-new-api-connection)
  - [Troubleshooting](#troubleshooting)
    - [Functions Won't Start Locally](#functions-wont-start-locally)
    - [Database Connection Errors](#database-connection-errors)
    - [Azurite Storage Issues](#azurite-storage-issues)
    - [ESLint / TypeScript Errors](#eslint--typescript-errors)
    - [Test Failures](#test-failures)
    - [API Authentication Issues](#api-authentication-issues)
  - [Adding New Azure Functions](#adding-new-azure-functions)
  - [Adding New Database Connections](#adding-new-database-connections)
  - [Adding New Database Connections](#adding-new-database-connections-1)
  - [Adding New DSi Internal API Connections](#adding-new-dsi-internal-api-connections)
  - [Key Dependencies](#key-dependencies)
    - [Runtime Dependencies](#runtime-dependencies)
    - [Development Dependencies](#development-dependencies)
    - [Build \& Deployment](#build--deployment)

## DevOps Requirements

- The app service for this repo, and the pipeline should be in the backend tier, as it's an automated function that isn't used by anything else.
- In `DevOps/pipeline/azure-pipeline.yml` make sure that `buildFlow: true` is set for the `pipeline/buildAzureFunctions.yml@devopsTemplates` template, this ensures the TypeScript code is transpiled into JavaScript so it will function correctly.

## Automated Tasks

- `deactivateUnusedAccounts`:
  - Default Timer: Midnight on the first day of every month.
  - Description: Deactivates and creates audit records for any users whose last login is older than 2 years from the current run date, or if their account was created over 2 years from the current run date and they never logged in since verifying their email address.
- `rejectOldOrganisationRequests`:
  - Default Timer: Midnight on every Monday.
  - Description: Rejects any organisation requests that are overdue or have no approvers, and were created over 3 months ago.
- `removeGeneratedTestAccounts`:
  - Default Timer: Midnight on every Monday.
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
    "TIMER_REJECT_OLD_ORGANISATION_REQUESTS": "0 0 0 * * 1",
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
    "AUDIT_TOPIC_NAME": "audit",
    "REDIS_CONNECTION_STRING": "",
    "SUPPORT_USER_ID": ""
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
| TIMER_REJECT_OLD_ORGANISATION_REQUESTS | The NCronTab expression that sets the schedule for the `rejectOldOrganisationRequests` function (`./src/functions/rejectOldOrganisationRequests`). | Read the [documentation on NCrontab formatting](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer?tabs=python-v2%2Cisolated-process%2Cnodejs-v4&pivots=programming-language-typescript#ncrontab-expressions) and use a [tester](https://ncrontab.swimburger.net/) to verify your expression runs as you'd expect. | `0 0 0 * * 1` Runs at 12AM UTC on every Monday. |
| TIMER_REMOVE_GENERATED_TEST_ACCOUNTS | The NCronTab expression that sets the schedule for the `removeGeneratedTestAccounts` function (`./src/functions/removeGeneratedTestAccounts`). | Read the [documentation on NCrontab formatting](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer?tabs=python-v2%2Cisolated-process%2Cnodejs-v4&pivots=programming-language-typescript#ncrontab-expressions) and use a [tester](https://ncrontab.swimburger.net/) to verify your expression runs as you'd expect. | `0 0 0 * * 1` Runs at 12AM UTC on every Monday. |
| TIMER_REMOVE_UNRESOLVED_INVITATIONS | The NCronTab expression that sets the schedule for the `removeUnresolvedInvitations` function (`./src/functions/removeUnresolvedInvitations`). | Read the [documentation on NCrontab formatting](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer?tabs=python-v2%2Cisolated-process%2Cnodejs-v4&pivots=programming-language-typescript#ncrontab-expressions) and use a [tester](https://ncrontab.swimburger.net/) to verify your expression runs as you'd expect. | `0 0 0 1 * *` Runs at 12AM UTC on the first day of every month. |
| DATABASE_DIRECTORIES_HOST | The directories database hostname/URL. | Retrieve from KeyVault (Key name: `platformGlobalServerName`) or other database connections. | `""`
| DATABASE_DIRECTORIES_NAME | The directories database name | Retrieve from KeyVault (Key name: `platformGlobalDirectoriesDatabaseName`) or other database connections. | `""`
| DATABASE_DIRECTORIES_USERNAME | SQL username for connecting to the directories database. | Use your own username or retrieve from KeyVault (Key name: `svcSigninDir`). | `""`
| DATABASE_DIRECTORIES_PASSWORD | SQL password for connecting to the directories database. | Use your own password or retrieve from KeyVault (Key name: `svcSigninDirPassword`). | `""`
| DATABASE_ORGANISATIONS_HOST | The organisations database hostname/URL. | Retrieve from KeyVault (Key name: `platformGlobalServerName`) or other database connections. | `""`
| DATABASE_ORGANISATIONS_NAME | The organisations database name | Retrieve from KeyVault (Key name: `platformGlobalOrganisationsDatabaseName`) or other database connections. | `""`
| DATABASE_ORGANISATIONS_USERNAME | SQL username for connecting to the organisations database. | Use your own username or retrieve from KeyVault (Key name: `svcSigninOrg`). | `""`
| DATABASE_ORGANISATIONS_PASSWORD | SQL password for connecting to the organisations database. | Use your own password or retrieve from KeyVault (Key name: `svcSigninOrgPassword`). | `""`
| API_INTERNAL_ACCESS_HOST | Host URL for the internal access API. | Retrieve from KeyVault (Key name: `standaloneAccessHostName`) or the "Domains" section of the app service's "Overview" page in the Azure portal. | `""`
| API_INTERNAL_DIRECTORIES_HOST | Host URL for the internal directories API. | Retrieve from KeyVault (Key name: `standaloneDirectoriesHostName`) or the "Domains" section of the app service's "Overview" page in the Azure portal. | `""`
| API_INTERNAL_ORGANISATIONS_HOST | Host URL for the internal organisations API. | Retrieve from KeyVault (Key name: `standaloneOrganisationsHostName`) or the "Domains" section of the app service's "Overview" page in the Azure portal. | `""`
| API_INTERNAL_TENANT | Tenant ID of the internal API tenant. | Retrieve from KeyVault (Key name: `aadkeytenantId` ). | `""`
| API_INTERNAL_AUTHORITY_HOST | Authority host URL of the internal API tenant. | Retrieve from KeyVault (Key name: `tenantUrl`). | `""`
| API_INTERNAL_CLIENT_ID | Client ID of the internal API tenant. | Retrieve from KeyVault (Key name: `aadshdclientid`: ). | `""`
| API_INTERNAL_CLIENT_SECRET | Client secret of the internal API tenant. | Retrieve from KeyVault (Key name: `aadshdclientsecret`). | `""`
| API_INTERNAL_RESOURCE | Resource ID of the internal API tenant. | Retrieve from KeyVault (Key name: `aadshdappid`). | `""`
| AUDIT_CONNECTION_STRING | Connection string of the environment's shared service bus. | Retrieve from KeyVault (Key name: `sharedServiceBusConnectionString`) or the service bus' "Shared access policies" page in the Azure portal. | `""`
| AUDIT_TOPIC_NAME | Service bus audit topic name. | Retrieve from KeyVault (Key name: `auditServiceBusTopicName`) or the service bus' "Overview" page in the Azure portal. | `"audit"`
| REDIS_CONNECTION_STRING | Redis connection string in the format `redis://username:password@host:port`. | Retrieve from KeyVault (Key name: `redisConn`) or from the "Azure Cache for Redis" section of the Azure Portal. | `""`
| SUPPORT_USER_ID | ID/sub of the support team account. | Retrieve from KeyVault (Key name: `supportUserId`) or the directories/organisations database for the environment. | `""`
## Testing

### Running Tests

Run all tests with coverage:

```bash
npm run test
```

Run tests for a specific file:

```bash
npm test -- src/functions/deactivateUnusedAccounts.test.ts
```

Run tests in watch mode (reruns tests as files change):

```bash
npm run watch
```

### Common Commands

```bash
npm run lint             # Check for linting issues
npm run lint:fix         # Auto-fix linting issues
npm run format           # Format all files with Prettier
npm run dev:checks       # Run linting and tests (recommended before commit)
```

### Pre-commit Hooks

Husky is configured to automatically run Prettier on all staged files when you commit. This ensures consistent formatting across the codebase.

## Common Development Tasks

### Modify an Existing Function

1. Open the function file in `src/functions/functionName.ts`
2. Make your changes
3. Update the corresponding test file in `test/functions/functionName.test.ts`
4. Run linting and tests:
   ```bash
   npm run dev:checks
   ```
5. Start debug mode to manually test:
   - Open "Run and Debug" menu in VSCode
   - Select "Attach to Node functions"
   - Click the start debugging button

### Add a New Function

See [Adding New Azure Functions](#adding-new-azure-functions) section below.

### Debug a Function Locally

1. Follow the steps in [Local Debugging](#local-debugging) section to set up your environment
2. In the Azure Functions extension in VSCode (Activity Bar > Azure > Workspace > Local Project > Functions):
   - Right-click the function you want to test
   - Select "Execute Function Now"
3. Set breakpoints in VSCode by clicking the line number
4. Inspect variable values and step through code using the debugger controls
5. Check the debug console for `context.log()` output

### Check Database Queries

When debugging database issues:

1. Enable `DEBUG: "true"` in `local.settings.json`
2. Run functions locally in debug mode
3. Detailed Sequelize SQL logging will appear in the debug console, showing generated queries and parameters
4. Use this to identify query issues or N+1 problems

### Add a New Database Connection

See [Adding New Database Connections](#adding-new-database-connections) section below.

### Add a New API Connection

See [Adding New DSi Internal API Connections](#adding-new-dsi-internal-api-connections) section below.

## Troubleshooting

### Functions Won't Start Locally

**Issue**: "Azure Functions Core Tools not found"
- **Solution**: Run "Azure Functions: Install or Update Azure Functions Core Tools" from VSCode command palette (`F1` or `Ctrl+Shift+P`)

**Issue**: Port 7071 already in use
- **Solution**: Close other function apps or change the port in `.vscode/settings.json`

**Issue**: Functions start but no output appears
- **Solution**: Check that Azurite storage emulator is running; run "Azurite: Start" from command palette

### Database Connection Errors

**Issue**: "Unable to connect to database" or timeout errors
- **Solution**: Verify database credentials in `local.settings.json` match your target environment
- **Solution**: Ensure your IP is whitelisted on the database server firewall
- **Solution**: For VPN users: Ensure `DEBUG: "true"` is set to connect via WebSockets

**Issue**: Connection string format error
- **Solution**: Verify all required fields are populated: host, name, username, password
- **Solution**: Check that special characters in passwords are not escaped

### Azurite Storage Issues

**Issue**: "Storage emulator not running" when starting functions
- **Solution**: Run "Azurite: Start" from VSCode command palette first

**Issue**: Files persist between runs causing test failures
- **Solution**: Run "Azurite: Clean" from command palette to clear emulator files

**Issue**: "Address already in use" for Azurite
- **Solution**: Stop all running Azurite instances and restart

### ESLint / TypeScript Errors

**Issue**: Build fails with TypeScript errors
- **Solution**: Run `npm run build` to see detailed errors
- **Solution**: Run `npm run lint:fix` to auto-fix many issues

**Issue**: "Cannot find module" error
- **Solution**: Check import paths use correct relative paths (e.g., `../` not `/`)
- **Solution**: Verify file extensions are included in imports if needed

### Test Failures

**Issue**: Tests pass locally but fail in CI/CD
- **Solution**: Ensure mocks are properly isolated; check that mock setup/teardown is correct
- **Solution**: Look for hardcoded dates/times; use mocked `Date` or test utilities
- **Solution**: Check for race conditions; use `jest.useFakeTimers()` if needed

### API Authentication Issues

**Issue**: "MSAL authentication failed" when calling internal APIs
- **Solution**: Verify API credentials in `local.settings.json`: `API_INTERNAL_CLIENT_ID`, `API_INTERNAL_CLIENT_SECRET`, etc.
- **Solution**: Check that client secret hasn't expired in Azure AD
- **Solution**: Ensure correct tenant ID is set (`API_INTERNAL_TENANT`)
## Adding New Azure Functions

In the following steps we'll create a new handler for our new timer trigger `functionName` Azure function, and register it with our function app.

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

### Build & Deployment

- **npm scripts** in `package.json` define build, test, lint, and watch tasks
- TypeScript is compiled to JavaScript in the `dist/` directory for Azure deployment
- The DevOps pipeline (`DevOps/pipeline/azure-pipeline.yml`) orchestrates CI/CD with `buildFlow: true` to enable TypeScript transpilation
