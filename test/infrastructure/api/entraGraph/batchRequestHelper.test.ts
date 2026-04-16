import {
  BatchRequestContent,
  BatchResponseContent,
  Client,
  GraphRequest,
} from "@microsoft/microsoft-graph-client";
import {
  BatchItemResponse,
  batchRequestHelper,
} from "../../../../src/infrastructure/api/entraGraph/batchRequestHelper";

jest.mock("@microsoft/microsoft-graph-client");

/**
 * Generates requests using the index as the URL path for testing.
 *
 * @param amount - The number of requests to generate.
 * @returns An array of {@link Request} objects for testing.
 */
function generateRequests(amount: number): Request[] {
  return Array.from(
    { length: amount },
    (_, index) => new Request(`https://example.local/${index}`),
  );
}

describe("batchRequestHelper", () => {
  const batchRequestMock = jest.mocked(BatchRequestContent);
  const batchResponseMock = jest.mocked(BatchResponseContent);
  const graphClientMock = jest.mocked(Client);
  let apiMock: jest.Mock;
  let postMock: jest.Mock;

  beforeEach(() => {
    postMock = jest.fn().mockResolvedValue({ ok: true });
    apiMock = jest.fn().mockImplementation(() => {
      const request: Partial<GraphRequest> = {
        post: postMock,
      };
      return request as GraphRequest;
    });
    graphClientMock.init.mockImplementation(() => {
      const client: Partial<Client> = {
        api: apiMock,
      };
      return client as Client;
    });

    batchResponseMock.prototype.getResponses.mockReturnValue(new Map());

    jest.useFakeTimers();
    jest.spyOn(globalThis, "setTimeout");
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("it doesn't call the Graph API if no requests are passed", async () => {
    await batchRequestHelper(
      [],
      graphClientMock.init({ authProvider: () => {} }),
    );

    expect(apiMock).not.toHaveBeenCalled();
  });

  it("it calls the Graph API once if there are less than 20 requests", async () => {
    await batchRequestHelper(
      generateRequests(2),
      graphClientMock.init({ authProvider: () => {} }),
    );

    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(apiMock).toHaveBeenCalledWith("/$batch");
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it("it calls the Graph API once if there are exactly 20 requests", async () => {
    await batchRequestHelper(
      generateRequests(20),
      graphClientMock.init({ authProvider: () => {} }),
    );

    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(apiMock).toHaveBeenCalledWith("/$batch");
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it("it calls the Graph API for each group of 20 if there are more than 20 requests", async () => {
    const requests = generateRequests(45);
    await batchRequestHelper(
      requests,
      graphClientMock.init({ authProvider: () => {} }),
    );

    expect(apiMock).toHaveBeenCalledTimes(3);
    expect(apiMock).toHaveBeenCalledWith("/$batch");
    expect(postMock).toHaveBeenCalledTimes(3);
    expect(batchRequestMock.mock.calls[0][0][0].request.url).toEqual(
      new URL(requests[0].url).pathname,
    );
    expect(batchRequestMock.mock.calls[1][0][0].request.url).toEqual(
      new URL(requests[20].url).pathname,
    );
    expect(batchRequestMock.mock.calls[2][0][0].request.url).toEqual(
      new URL(requests[40].url).pathname,
    );
  });

  it("it rejects with an error if batchRequestContent throws an error", async () => {
    expect.hasAssertions();
    const methodError = new Error("batchRequestContent error");
    batchRequestMock.prototype.getContent.mockRejectedValue(methodError);

    try {
      await batchRequestHelper(
        generateRequests(1),
        graphClientMock.init({ authProvider: () => {} }),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty(
        "message",
        `Graph API batch handler error: ${methodError.message}`,
      );
    }
  });

  it("it rejects with an error if the Graph API post method throws an error", async () => {
    expect.hasAssertions();
    const methodError = new Error("post error");
    postMock.mockRejectedValue(methodError);

    try {
      await batchRequestHelper(
        generateRequests(1),
        graphClientMock.init({ authProvider: () => {} }),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty(
        "message",
        `Graph API batch handler error: ${methodError.message}`,
      );
    }
  });

  it("it returns responses with success as true, the returned status code, and body as-is if requests are successful (2xx response status)", async () => {
    const responses = new Map([
      ["0", new Response("test", { status: 200 })],
      ["1", new Response("test2", { status: 201 })],
    ]);
    batchResponseMock.prototype.getResponses.mockReturnValue(responses);
    const results = await batchRequestHelper(
      generateRequests(2),
      graphClientMock.init({ authProvider: () => {} }),
    );

    expect(results).toStrictEqual<BatchItemResponse[]>([
      {
        index: 0,
        success: true,
        status: 200,
        errorCode: undefined,
        errorMessage: undefined,
        body: responses.get("0").body,
      },
      {
        index: 1,
        success: true,
        status: 201,
        errorCode: undefined,
        errorMessage: undefined,
        body: responses.get("1").body,
      },
    ]);
  });

  it("it returns responses with success as false, the returned status code, and the body as an object if requests fail (non-2xx and not 429 response status) and the body has a JSON content type", async () => {
    const bodies = ['{"test": true}', '{"test1": true}'];
    const responses = new Map([
      [
        "0",
        new Response(bodies[0], {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ],
      [
        "1",
        new Response(bodies[1], {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ],
    ]);
    batchResponseMock.prototype.getResponses.mockReturnValue(responses);
    const results = await batchRequestHelper(
      generateRequests(2),
      graphClientMock.init({ authProvider: () => {} }),
    );

    expect(results).toEqual<BatchItemResponse[]>([
      {
        index: 0,
        success: false,
        status: 500,
        errorCode: undefined,
        errorMessage: undefined,
        body: JSON.parse(bodies[0]),
      },
      {
        index: 1,
        success: false,
        status: 401,
        errorCode: undefined,
        errorMessage: undefined,
        body: JSON.parse(bodies[1]),
      },
    ]);
  });

  it("it returns responses with the error code and message if requests fail (non-2xx and not 429 response status), the body has a JSON content type, and the error matches the Graph API standard", async () => {
    const bodies = [
      '{"error": {"code": "error", "message": "test"}}',
      '{"error": {"code": "error1", "message": "test1"}}',
    ];
    const responses = new Map([
      [
        "0",
        new Response(bodies[0], {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ],
      [
        "1",
        new Response(bodies[1], {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ],
    ]);
    batchResponseMock.prototype.getResponses.mockReturnValue(responses);
    const results = await batchRequestHelper(
      generateRequests(2),
      graphClientMock.init({ authProvider: () => {} }),
    );

    expect(results).toEqual<BatchItemResponse[]>([
      {
        index: 0,
        success: false,
        status: 500,
        errorCode: "error",
        errorMessage: "test",
        body: JSON.parse(bodies[0]),
      },
      {
        index: 1,
        success: false,
        status: 401,
        errorCode: "error1",
        errorMessage: "test1",
        body: JSON.parse(bodies[1]),
      },
    ]);
  });

  it("it returns responses with success as false, the returned status code, and the body as-is if requests fail (non-2xx and not 429 response status) and the body does not have a JSON content type", async () => {
    const responses = new Map([
      [
        "0",
        new Response("test", {
          status: 500,
          headers: {
            "Content-Type": "text/plain",
          },
        }),
      ],
      [
        "1",
        new Response("test1", {
          status: 401,
          headers: {
            "Content-Type": "text/plain",
          },
        }),
      ],
    ]);
    batchResponseMock.prototype.getResponses.mockReturnValue(responses);
    const results = await batchRequestHelper(
      generateRequests(2),
      graphClientMock.init({ authProvider: () => {} }),
    );

    expect(results).toEqual<BatchItemResponse[]>([
      {
        index: 0,
        success: false,
        status: 500,
        errorCode: undefined,
        errorMessage: undefined,
        body: responses.get("0").body,
      },
      {
        index: 1,
        success: false,
        status: 401,
        errorCode: undefined,
        errorMessage: undefined,
        body: responses.get("1").body,
      },
    ]);
  });

  it("it returns responses with success as false, the returned status code, and the body as-is if requests fail (non-2xx and not 429 response status) and the body does not have a 'Content-Type' header", async () => {
    const responses = [
      new Response(null, {
        status: 500,
      }),
      new Response(null, {
        status: 401,
      }),
    ];
    responses.forEach((response) => response.headers.delete("Content-Type"));
    const returnedResponses = new Map([
      ["0", responses[0]],
      ["1", responses[1]],
    ]);

    batchResponseMock.prototype.getResponses.mockReturnValue(returnedResponses);
    const results = await batchRequestHelper(
      generateRequests(2),
      graphClientMock.init({ authProvider: () => {} }),
    );

    expect(results).toEqual<BatchItemResponse[]>([
      {
        index: 0,
        success: false,
        status: 500,
        errorCode: undefined,
        errorMessage: undefined,
        body: returnedResponses.get("0").body,
      },
      {
        index: 1,
        success: false,
        status: 401,
        errorCode: undefined,
        errorMessage: undefined,
        body: returnedResponses.get("1").body,
      },
    ]);
  });

  it("it retries the correct requests if they are retryable (429 response status) as the responses aren't in order", async () => {
    const requests = Array.from(
      { length: 4 },
      (_, index) =>
        new Request(`https://graph.microsoft.com/v1.0/users/${index}`, {
          method: "DELETE",
        }),
    );
    const responses = new Map(
      Array.from({ length: 4 }, (_, index) => [
        index.toString(),
        new Response(null, {
          status: index % 2 === 0 ? 429 : 204,
          headers: {
            "Retry-After": index.toString(),
          },
        }),
      ]),
    );
    batchResponseMock.prototype.getResponses
      .mockReturnValueOnce(responses)
      .mockReturnValueOnce(
        new Map(
          Array.from({ length: 2 }, (_, index) => [
            index.toString(),
            new Response(null, {
              status: 204,
            }),
          ]),
        ),
      );
    const result = batchRequestHelper(
      requests,
      graphClientMock.init({ authProvider: () => {} }),
    );
    await jest.runAllTimersAsync();

    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);

    await result;
    expect(batchRequestMock).toHaveBeenCalledTimes(2);
    // The later request goes first due to unshift appending to the front.
    expect(batchRequestMock.mock.calls[1][0][0].id).toEqual("2");
    expect(batchRequestMock.mock.calls[1][0][0].request.url).toEqual(
      "/users/2",
    );
    expect(batchRequestMock.mock.calls[1][0][1].id).toEqual("0");
    expect(batchRequestMock.mock.calls[1][0][1].request.url).toEqual(
      "/users/0",
    );
  });

  it("it waits for the longest 'Retry-After' heading value if any requests are retryable (429 response status)", async () => {
    const responses = new Map(
      Array.from({ length: 3 }, (_, index) => [
        index.toString(),
        new Response("", {
          status: 429,
          headers: {
            "Retry-After": index.toString(),
          },
        }),
      ]),
    );
    batchResponseMock.prototype.getResponses
      .mockReturnValueOnce(responses)
      .mockReturnValueOnce(
        new Map(
          Array.from({ length: 3 }, (_, index) => [
            index.toString(),
            new Response(null, {
              status: 204,
            }),
          ]),
        ),
      );
    batchRequestHelper(
      generateRequests(3),
      graphClientMock.init({ authProvider: () => {} }),
    );
    await jest.runAllTimersAsync();

    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);
  });

  it("it does not wait if all requests in the batch are non-retryable (not 429 response status)", async () => {
    const responses = new Map(
      Array.from({ length: 20 }, (_, index) => [
        index.toString(),
        new Response("", { status: 200 }),
      ]),
    );
    batchResponseMock.prototype.getResponses.mockReturnValue(responses);
    batchRequestHelper(
      generateRequests(21),
      graphClientMock.init({ authProvider: () => {} }),
    );
    await jest.runAllTimersAsync();

    expect(setTimeout).not.toHaveBeenCalled();
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it("it strips the /v1.0 prefix and produces a batch-relative URL before building BatchRequestContent", async () => {
    const requests = [
      new Request("https://graph.microsoft.com/v1.0/users/abc-123", {
        method: "DELETE",
      }),
    ];
    await batchRequestHelper(
      requests,
      graphClientMock.init({ authProvider: () => {} }),
    );

    expect(batchRequestMock).toHaveBeenCalledTimes(1);
    const step = batchRequestMock.mock.calls[0][0][0];
    expect(step.request.url).toEqual("/users/abc-123");
    expect(step.request.method).toEqual("DELETE");
    expect(step.request.headers).toBe(requests[0].headers);
  });

  it("it strips the /beta prefix and produces a batch-relative URL before building BatchRequestContent", async () => {
    const requests = [
      new Request("https://graph.microsoft.com/beta/users/abc-123", {
        method: "DELETE",
      }),
    ];
    await batchRequestHelper(
      requests,
      graphClientMock.init({ authProvider: () => {} }),
    );

    expect(batchRequestMock).toHaveBeenCalledTimes(1);
    const step = batchRequestMock.mock.calls[0][0][0];
    expect(step.request.url).toEqual("/users/abc-123");
    expect(step.request.method).toEqual("DELETE");
    expect(step.request.headers).toBe(requests[0].headers);
  });

  it("it preserves query parameters while stripping the API version prefix", async () => {
    const requests = [
      new Request(
        "https://graph.microsoft.com/v1.0/users/abc-123?$select=id,displayName&$count=true",
        {
          method: "GET",
        },
      ),
    ];
    await batchRequestHelper(
      requests,
      graphClientMock.init({ authProvider: () => {} }),
    );

    expect(batchRequestMock).toHaveBeenCalledTimes(1);
    const step = batchRequestMock.mock.calls[0][0][0];
    expect(step.request.url).toEqual(
      "/users/abc-123?$select=id,displayName&$count=true",
    );
    expect(step.request.method).toEqual("GET");
    expect(step.request.headers).toBe(requests[0].headers);
  });

  it("it returns an empty array without throwing if getResponses returns undefined (malformed batch response)", async () => {
    batchResponseMock.prototype.getResponses.mockReturnValue(
      undefined as unknown as Map<string, Response>,
    );
    const results = await batchRequestHelper(
      generateRequests(1),
      graphClientMock.init({ authProvider: () => {} }),
    );

    expect(results).toEqual([]);
  });

  it("it returns an empty array without throwing if getResponses returns an empty map", async () => {
    batchResponseMock.prototype.getResponses.mockReturnValue(new Map());
    const results = await batchRequestHelper(
      generateRequests(1),
      graphClientMock.init({ authProvider: () => {} }),
    );

    expect(results).toEqual([]);
  });

  it("it does not wait a second time if some requests in a batch are retried then succeed with more requests remaining", async () => {
    const responses = new Map(
      Array.from({ length: 20 }, (_, index) => [
        index.toString(),
        new Response("", {
          status: 429,
          headers: {
            "Retry-After": index.toString(),
          },
        }),
      ]),
    );
    batchResponseMock.prototype.getResponses
      .mockReturnValueOnce(responses)
      .mockReturnValue(
        new Map(
          Array.from({ length: 20 }, (_, index) => [
            index.toString(),
            new Response("", { status: 200 }),
          ]),
        ),
      );
    batchRequestHelper(
      generateRequests(21),
      graphClientMock.init({ authProvider: () => {} }),
    );
    await jest.runAllTimersAsync();

    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledTimes(3);
  });
});
