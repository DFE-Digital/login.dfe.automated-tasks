import {
  BatchRequestContent,
  BatchRequestStep,
  BatchResponseBody,
  BatchResponseContent,
  Client,
} from "@microsoft/microsoft-graph-client";

/**
 * Returns a Request-compatible object using only the pathname of the original request's URL.
 *
 * BatchRequestContent requires relative URLs in batch item requests (e.g. /v1.0/users/{id}).
 * Using an absolute URL causes Graph to return 400 "Resource not found for the segment 'v1.0'".
 * We can't construct a real `Request` with a relative URL in Node (the URL constructor rejects it),
 * so we build a plain object that carries the relative path while preserving the real `Headers`
 * instance from the source request so the SDK's internal `headers.forEach()` never receives undefined.
 *
 * @param request - A real Request instance with an absolute URL.
 * @returns A Request-shaped object whose `.url` is the pathname only.
 */
function toRelativeRequest(request: Request): Request {
  return {
    url: new URL(request.url).pathname,
    method: request.method,
    headers: request.headers,
    body: request.body,
  } as unknown as Request;
}

export type BatchItemResponse = {
  index: number;
  success: boolean;
  status: number;
  errorCode: string | undefined;
  errorMessage: string | undefined;
  body: ReadableStream<Uint8Array> | object;
};

/**
 * Wraps a set of independent requests to the Graph API using JSON batching to reduce the number of network calls.
 *
 * This wrapper handles 429 responses using the "Retry-After" header and handles errors, returning the
 * error body object as well as the code/message for callers to use.
 *
 * @param requests - An array of requests to be made to the Graph API.
 * @param client - The Graph API client {@link Client} to use for requests.
 * @returns An array of {@link BatchItemResponse} elements (NOT in input order), or an empty array if no requests were given.
 */
export async function batchRequestHelper(
  requests: Request[],
  client: Client,
): Promise<BatchItemResponse[]> {
  const batchSteps: BatchRequestStep[] = [...requests].map(
    (request, index) => ({
      id: index.toString(),
      request: toRelativeRequest(request),
    }),
  );
  const responses: BatchItemResponse[] = [];
  let retrySeconds = 0;

  while (batchSteps.length > 0) {
    if (retrySeconds) {
      await new Promise((resolve) => setTimeout(resolve, retrySeconds * 1000));
      retrySeconds = 0;
    }

    const currentBatch = batchSteps.splice(0, 20);
    let batchResponse: BatchResponseBody;
    try {
      batchResponse = await client
        .api("/$batch")
        .post(await new BatchRequestContent(currentBatch).getContent());
    } catch (error) {
      return Promise.reject(
        new Error(`Graph API batch handler error: ${error.message}`),
      );
    }
    const rawResponses = [
      ...(new BatchResponseContent(batchResponse).getResponses() ?? new Map()),
    ];

    for (const [id, response] of rawResponses) {
      if (response.status === 429) {
        retrySeconds = Math.max(
          retrySeconds,
          parseInt(response.headers.get("Retry-After"), 10) || 0,
        );
        batchSteps.unshift({
          id,
          request: toRelativeRequest(requests[parseInt(id, 10)].clone()),
        });
      } else {
        const body =
          !response.ok &&
          response.headers.get("Content-Type")?.includes("application/json")
            ? await response.json()
            : response.body;

        responses.push({
          index: parseInt(id, 10),
          success: response.ok,
          status: response.status,
          body,
          errorCode: !response.ok ? body?.error?.code : undefined,
          errorMessage: !response.ok ? body?.error?.message : undefined,
        });
      }
    }
  }

  return responses;
}
