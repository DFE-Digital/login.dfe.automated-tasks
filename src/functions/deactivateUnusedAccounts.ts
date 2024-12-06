import { InvocationContext, Timer } from "@azure/functions";

export async function deactivateUnusedAccounts(myTimer: Timer, context: InvocationContext): Promise<void> {
    context.log('deactivateUnusedAccounts function processed request.');
}
