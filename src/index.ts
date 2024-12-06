import { app } from '@azure/functions';
import { deactivateUnusedAccounts } from './functions/deactivateUnusedAccounts';

app.setup({
    enableHttpStream: true,
});

app.timer('deactivateUnusedAccounts', {
    schedule: '%DeactivateUnusedAccountsTimer%',
    handler: deactivateUnusedAccounts
});
