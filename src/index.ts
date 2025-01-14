import { app, type RetryOptions } from "@azure/functions";
import { deactivateUnusedAccounts } from "./functions/deactivateUnusedAccounts";
import { removeGeneratedTestAccounts } from "./functions/removeGeneratedTestAccounts";

app.setup({
  enableHttpStream: true,
});

const defaultRetryStrategy: RetryOptions = {
  strategy: "exponentialBackoff",
  maximumInterval: 300000,
  minimumInterval: 30000,
  maxRetryCount: 5,
};

app.timer("deactivateUnusedAccounts", {
  schedule: "%TIMER_DEACTIVATE_UNUSED_ACCOUNTS%",
  handler: deactivateUnusedAccounts,
  retry: defaultRetryStrategy,
});

app.timer("removeGeneratedTestAccounts", {
  schedule: "%TIMER_REMOVE_GENERATED_TEST_ACCOUNTS%",
  handler: removeGeneratedTestAccounts,
  retry: defaultRetryStrategy,
});
