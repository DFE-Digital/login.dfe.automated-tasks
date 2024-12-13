import { app } from '@azure/functions';
import { deactivateUnusedAccounts } from './functions/deactivateUnusedAccounts';

app.setup({
  enableHttpStream: true,
});

app.timer('deactivateUnusedAccounts', {
  schedule: '%TIMER_DEACTIVATE_UNUSED_ACCOUNTS%',
  handler: deactivateUnusedAccounts,
  retry: {
    strategy: "exponentialBackoff",
    maximumInterval: 300000,
    minimumInterval: 30000,
    maxRetryCount: 5,
  },
});
