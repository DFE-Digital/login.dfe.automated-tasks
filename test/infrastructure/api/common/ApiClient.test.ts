import { ApiClient, ApiRequestMethod } from "../../../../src/infrastructure/api/common/ApiClient";

describe("Base API client", () => {
  const originalFetch = globalThis.fetch;
  const mockedFetch = jest.fn();
  const defaultOptions = {
    baseUri: "https://testing.test/",
  };
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient(defaultOptions);
    globalThis.fetch = mockedFetch.mockResolvedValue({
      status: 200,
      ok: true,
      body: "Testing Testing 123",
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("requestRaw", () => {
    it.each([
      ["", defaultOptions.baseUri],
      ["/", defaultOptions.baseUri],
      ["test", `${defaultOptions.baseUri}test`],
      ["/test", `${defaultOptions.baseUri}test`],
      ["test.html", `${defaultOptions.baseUri}test.html`],
      ["/test.html", `${defaultOptions.baseUri}test.html`],
      ["test/test2", `${defaultOptions.baseUri}test/test2`],
      ["/test/test2", `${defaultOptions.baseUri}test/test2`],
    ])("it makes a request to the correct URI (Path: %p | URI: %p)", async (path, uri) => {
      await apiClient.requestRaw(ApiRequestMethod.GET, path, {});

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[0].href).toEqual(uri);
    });

    it.each([
      ApiRequestMethod.DELETE,
      ApiRequestMethod.GET,
      ApiRequestMethod.PATCH,
      ApiRequestMethod.POST,
      ApiRequestMethod.PUT,
    ])("it makes a request to the specified method (%p)", async (method) => {
      await apiClient.requestRaw(method, "", {});

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].method).toEqual(method);
    });

    it("it passes null as the body if the method is GET", async () => {
      await apiClient.requestRaw(ApiRequestMethod.GET, "", {
        body: "test",
      });

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].body).toEqual(null);
    });

    it("it passes the JSON stringified body if the method is not GET and the body option is an object", async () => {
      const requestBody = {
        test: "testing",
      };
      await apiClient.requestRaw(ApiRequestMethod.POST, "", {
        body: requestBody,
      });

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].body).toEqual(JSON.stringify(requestBody));
    });

    it("it passes the string body if the method is not GET, and the body is not an object", async () => {
      const requestBody = "testing123";
      await apiClient.requestRaw(ApiRequestMethod.POST, "", {
        body: requestBody,
      });

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].body).toEqual(requestBody);
      expect(mockedFetch.mock.lastCall[1].body).not.toEqual(JSON.stringify(requestBody));
    });

    it("it passes null as the body if the method is not GET and the body option isn't set", async () => {
      await apiClient.requestRaw(ApiRequestMethod.POST, "", {
        body: undefined,
      });

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].body).toEqual(null);
    });

    it("it passes the specified headers to the request", async () => {
      const requestOptions = {
        headers: new Headers({
          foo: "Bar",
          testing: "123",
        }),
      };
      await apiClient.requestRaw(ApiRequestMethod.GET, "", requestOptions);

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].headers).toEqual(requestOptions.headers);
    });

    it("it doesn't pass headers if none are specified and correlationId/body options aren't set", async () => {
      const requestOptions = {
        body: undefined,
        correlationId: undefined,
        headers: undefined,
      };
      await apiClient.requestRaw(ApiRequestMethod.GET, "", requestOptions);

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].headers).toEqual(new Headers());
    });

    it("it passes a correlation ID header if the correlationId option is set", async () => {
      const requestOptions = {
        correlationId: "testing123",
      };
      await apiClient.requestRaw(ApiRequestMethod.GET, "", requestOptions);

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].headers).toEqual(new Headers({
        "x-correlation-id": requestOptions.correlationId,
      }));
    });

    it("it passes a JSON content type header if the method is not GET and the body option is an object", async () => {
      const requestOptions = {
        body: {},
      };
      await apiClient.requestRaw(ApiRequestMethod.POST, "", requestOptions);

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].headers).toEqual(new Headers({
        "content-type": "application/json",
      }));
    });

    it("it doesn't pass a JSON content type header if the method is not GET and the body option is not an object", async () => {
      const requestOptions = {
        body:  "testing123",
      };
      await apiClient.requestRaw(ApiRequestMethod.GET, "", requestOptions);

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].headers).toEqual(new Headers());
    });

    it("it doesn't pass a JSON content type header if the method is GET and the body option is an object", async () => {
      const requestOptions = {
        body: {},
      };
      await apiClient.requestRaw(ApiRequestMethod.GET, "", requestOptions);

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1].headers).toEqual(new Headers());
    });

    it("it passes no headers and null as the body if the method is GET and the options are not defined", async () => {
      await apiClient.requestRaw(ApiRequestMethod.GET, "");

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1]).toEqual({
        method: ApiRequestMethod.GET,
        body: null,
        headers: new Headers(),
      });
    });

    it("it passes no headers and null as the body if the method isn't GET and the options are not defined", async () => {
      await apiClient.requestRaw(ApiRequestMethod.POST, "");

      expect(mockedFetch).toHaveBeenCalled();
      expect(mockedFetch.mock.lastCall[1]).toEqual({
        method: ApiRequestMethod.POST,
        body: null,
        headers: new Headers(),
      });
    });

    it("it rejects with an Error with a correlationId if fetch throws an error, and correlationId is set", async () => {
      const errorMessage = "Fetch Failed";
      mockedFetch.mockRejectedValue(new Error(errorMessage));
      const requestOptions = {
        correlationId: "testing123",
      };

      try {
        await apiClient.requestRaw(ApiRequestMethod.GET, "", requestOptions);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toHaveProperty(
          "message",
          `API fetch error "${errorMessage}" (baseUri: ${defaultOptions.baseUri}, correlationId: ${requestOptions.correlationId})`
        );
      }
    });

    it("it rejects with an Error without a correlationId if fetch throws an error, and correlationId is not set", async () => {
      const errorMessage = "Fetch Failed";
      mockedFetch.mockRejectedValue(new Error(errorMessage));

      try {
        await apiClient.requestRaw(ApiRequestMethod.GET, "", {});
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toHaveProperty(
          "message",
          `API fetch error "${errorMessage}" (baseUri: ${defaultOptions.baseUri}, correlationId: Not provided)`
        );
      }
    });

    it("it rejects with an Error with a correlationId if the response is not ok, the status is not 404, and correlationId is set", async () => {
      const failedResponse = {
        status: 500,
        statusText: "Internal Server Error",
        ok: false,
      };
      mockedFetch.mockResolvedValue(failedResponse);
      const requestOptions = {
        correlationId: "testing123",
      };

      try {
        await apiClient.requestRaw(ApiRequestMethod.GET, "", requestOptions);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toHaveProperty(
          "message",
          `API request failed with status ${failedResponse.status} "${failedResponse.statusText}" (baseUri: ${defaultOptions.baseUri}, correlationId: ${requestOptions.correlationId})`
        );
      }
    });

    it("it rejects with an Error without a correlationId if the response is not ok, the status is not 404, and correlationId is not set", async () => {
      const failedResponse = {
        status: 500,
        statusText: "Internal Server Error",
        ok: false,
      };
      mockedFetch.mockResolvedValue(failedResponse);

      try {
        await apiClient.requestRaw(ApiRequestMethod.GET, "", {});
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toHaveProperty(
          "message",
          `API request failed with status ${failedResponse.status} "${failedResponse.statusText}" (baseUri: ${defaultOptions.baseUri}, correlationId: Not provided)`
        );
      }
    });

    it("it resolves with the response if the response status is 404, and the response is not ok", async () => {
      const failedResponse = {
        status: 404,
        statusText: "Not Found",
        ok: false,
      };
      mockedFetch.mockResolvedValue(failedResponse);
      const result = await apiClient.requestRaw(ApiRequestMethod.GET, "", {});

      expect(result).toEqual(failedResponse);
    });

    it("it resolves with the response if the response is ok", async () => {
      const successfulResponse = {
        status: 200,
        ok: true,
      };
      mockedFetch.mockResolvedValue(successfulResponse);
      const result = await apiClient.requestRaw(ApiRequestMethod.GET, "", {});

      expect(result).toEqual(successfulResponse);
    });
  });

  describe("request", () => {
    let spyRequestRaw: jest.SpyInstance<Promise<Response>, any, any>;

    beforeEach(() => {
      spyRequestRaw = jest.spyOn(apiClient, "requestRaw").mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.resolve("JSON: Testing Testing 123"),
      } as Response);
    });

    it("it passes the method, path, and options to the requestRaw function", async () => {
      const requestOptions = {
        correlationId: "testing123",
        headers: new Headers({
          test: "testing"
        }),
        body: "testing testing 123",
      };
      await apiClient.request(ApiRequestMethod.GET, "test", requestOptions);

      expect(apiClient.requestRaw).toHaveBeenCalled();
      expect(apiClient.requestRaw).toHaveBeenCalledWith(ApiRequestMethod.GET, "test", requestOptions);
    });

    it("it rejects with an Error if the response body fails to parse as JSON when the response status is not 404", async () => {
      const errorMessage = "Couldn't parse JSON test error";
      spyRequestRaw.mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.reject(new Error(errorMessage)),
      } as Response);

      try {
        await apiClient.request(ApiRequestMethod.GET, "", {});
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toHaveProperty(
          "message",
          `API response body JSON parse failed "${errorMessage}"`
        );
      }
    });

    it("it returns the JSON parsed response body if the response status is not 404", async () => {
      const result = await apiClient.request(ApiRequestMethod.GET, "", {});

      expect(apiClient.requestRaw).toHaveBeenCalled();
      expect(result).toEqual("JSON: Testing Testing 123");
    });

    it("it returns null if the response status is 404", async () => {
      spyRequestRaw.mockResolvedValue({
        status: 404,
        ok: false,
      } as Response);
      const result = await apiClient.request(ApiRequestMethod.GET, "", {});

      expect(apiClient.requestRaw).toHaveBeenCalled();
      expect(result).toEqual(null);
    });
  });
});
