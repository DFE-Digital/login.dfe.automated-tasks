import { InvocationContext, Timer } from "@azure/functions";

/**
 * Rejects organisation requests that are overdue and were created over 3 months ago.
 *
 * @param _ - Azure function {@link Timer} to handle scheduling information.
 * @param context - Azure function {@link InvocationContext} to log and retrieve invocation data.
 */
export async function rejectOldOrganisationRequests(
  _: Timer,
  context: InvocationContext,
): Promise<void> {
  try {
    const correlationId = context.invocationId;
  } catch (error) {
    throw new Error(`rejectOldOrganisationRequests: ${error.message}`);
  }
}
