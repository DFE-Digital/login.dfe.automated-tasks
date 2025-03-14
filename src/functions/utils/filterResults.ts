/**
 * Result of performing actions on objects, usually through the API, with the object used and whether the action(s) were successful.
 */
export type actionResult<T> = {
  object: T,
  success: boolean,
};

/**
 * Filters settled promise results into successful, failed, and errored states.
 *
 * @param results - Settled promise results, to be filtered into different statuses.
 * @returns An object containing the count/objects for success/failed results, and the count/errors for errored results.
 */
export function filterResults<T>(results: PromiseSettledResult<actionResult<T>>[]): {
  successful: {
    count: number,
    objects: T[],
  },
  failed: {
    count: number,
    objects: T[],
  },
  errored: {
    count: number,
    errors: string[],
  },
} {
  const successfulPromises = results.filter((result): result is PromiseFulfilledResult<actionResult<T>> =>
    result.status === "fulfilled"
    && result.value.success === true
  );
  const failedPromises = results.filter((result): result is PromiseFulfilledResult<actionResult<T>> =>
    result.status === "fulfilled"
    && result.value.success === false
  );
  const erroredPromises = results.filter((result): result is PromiseRejectedResult =>
    result.status === "rejected"
  );
  const errorReasons = erroredPromises.flatMap((rejection) => rejection.reason);

  return {
    successful: {
      count: successfulPromises.length,
      objects: successfulPromises.map((result) => result.value.object),
    },
    failed: {
      count: failedPromises.length,
      objects: failedPromises.map((result) => result.value.object),
    },
    errored: {
      count: erroredPromises.length,
      errors: [...new Set(errorReasons.map((reason) => (reason instanceof Error) ? reason.message : reason))],
    },
  };
};
