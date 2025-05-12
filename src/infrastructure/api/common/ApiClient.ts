/**
 * Options for constructing a base ApiClient.
 */
export interface ApiClientOptions {
  baseUri: string;
}

/**
 * Possible options for ApiClient requests.
 */
export interface ApiRequestOptions {
  correlationId?: string;
  headers?: Headers;
  body?: object | string;
}

/**
 * Possible HTTP methods for ApiClient requests.
 */
export enum ApiRequestMethod {
  GET = "GET",
  POST = "POST",
  PATCH = "PATCH",
  PUT = "PUT",
  DELETE = "DELETE",
}

/**
 * A base API Client for making HTTP requests.
 */
export class ApiClient {
  protected baseUri: string;

  /**
   * Instantiates a new API client ({@link ApiClient}) to make API HTTP requests.
   *
   * @param options - {@link ApiClientOptions} object to configure the ApiClient.
   */
  constructor(options: ApiClientOptions) {
    this.baseUri = options.baseUri;
  }

  /**
   * Builds a HTTP request body for making an API request.
   *
   * @param method - HTTP request method ({@link ApiRequestMethod}).
   * @param options - HTTP request options ({@link ApiRequestOptions}).
   * @returns The HTTP request body/null if the method is GET or no bodies are entered.
   */
  private buildBody(
    method: ApiRequestMethod,
    options?: ApiRequestOptions,
  ): string | null {
    if (method !== ApiRequestMethod.GET) {
      return typeof options?.body === "object"
        ? JSON.stringify(options.body)
        : (options?.body ?? null);
    }

    return null;
  }

  /**
   * Builds the HTTP headers object for making API requests.
   *
   * @param method - HTTP request method ({@link ApiRequestMethod}).
   * @param options - HTTP request options ({@link ApiRequestOptions}).
   * @returns The HTTP request headers object.
   */
  private buildHeaders(
    method: ApiRequestMethod,
    options?: ApiRequestOptions,
  ): Headers {
    const headers = options?.headers ?? new Headers();

    if (typeof options?.correlationId === "string") {
      headers.set("x-correlation-id", options.correlationId);
    }

    if (method !== ApiRequestMethod.GET && typeof options?.body === "object") {
      headers.set("content-type", "application/json");
    }

    return headers;
  }

  /**
   * Makes a HTTP request using the given method to the given path of the API.
   *
   * @param method - HTTP request method ({@link ApiRequestMethod}).
   * @param path - API path excluding the base URI.
   * @param options - HTTP request options ({@link ApiRequestOptions}).
   * @returns The HTTP response.
   */
  async requestRaw(
    method: ApiRequestMethod,
    path: string,
    options?: ApiRequestOptions,
  ): Promise<Response> {
    const errorInfo = `(baseUri: ${this.baseUri}, correlationId: ${options?.correlationId ?? "Not provided"})`;
    let response: Response;

    try {
      response = await fetch(new URL(path, this.baseUri), {
        method,
        body: this.buildBody(method, options),
        headers: this.buildHeaders(method, options),
      });
    } catch (error) {
      return Promise.reject(
        new Error(`API fetch error "${error.message}" ${errorInfo}`),
      );
    }

    if (response.status !== 404 && !response.ok) {
      return Promise.reject(
        new Error(
          `API request failed with status ${response.status} "${response.statusText}" ${errorInfo}`,
        ),
      );
    }

    return response;
  }

  /**
   * Makes a HTTP request using the given method to the given path of the API, attempting to cast as the specified object.
   *
   * @param method - HTTP request method ({@link ApiRequestMethod}).
   * @param path - API path excluding the base URI.
   * @param options - HTTP request options ({@link ApiRequestOptions}).
   * @returns The requested JSON object if the response is not 404, otherwise null.
   */
  async request<T>(
    method: ApiRequestMethod,
    path: string,
    options?: ApiRequestOptions,
  ): Promise<T | null> {
    const response = await this.requestRaw(method, path, options);
    try {
      return response.status !== 404 ? ((await response.json()) as T) : null;
    } catch (error) {
      return Promise.reject(
        new Error(`API response body JSON parse failed "${error.message}"`),
      );
    }
  }
}
