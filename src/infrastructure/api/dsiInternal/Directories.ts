import { ApiRequestMethod } from "../common/ApiClient";
import { ApiName, DsiInternalApiClient } from "./DsiInternalApiClient";

export type safeUserRecord = {
  sub: string;
  given_name: string;
  family_name: string;
  email: string;
  job_title: string | null;
  status: 0 | 1;
  phone_number: string | null;
  last_login: string | null;
  prev_login: string | null;
  isEntra: boolean;
  entraOid: string | null;
  entraLinked: string | null;
  isInternalUser: boolean;
  entraDeferUntil: string | null;
};

/**
 * Wrapper for the internal Directories API client, turning required endpoints into functions.
 */
export class Directories {
  private client: DsiInternalApiClient;

  /**
   * Instantiates a wrapper for the internal Directories API client.
   *
   * @throws Error if the host URL/auth environment variables are not set.
   */
  constructor() {
    this.client = new DsiInternalApiClient(ApiName.Directories);
  }

  /**
   * Gets user details for all existing users in a given array of user IDs.
   *
   * @param ids - The IDs of users to retrieve details for.
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns An array of {@link safeUserRecord} elements, or an empty array if none exist.
   */
  async getUsersByIds(
    ids: string[],
    correlationId: string,
  ): Promise<safeUserRecord[]> {
    if (ids.length === 0) {
      return Promise.reject(
        new Error("getUsersByIds must be called with at least one user ID"),
      );
    }

    return (
      (await this.client.request<safeUserRecord[]>(
        ApiRequestMethod.POST,
        "/users/by-ids",
        {
          correlationId,
          body: {
            ids: ids.join(),
          },
        },
      )) ?? []
    );
  }

  /**
   * Deactivates a user account.
   *
   * @param id - The ID of the user to be deactivated.
   * @param reason - The reason for the deactivation
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns true if the user was deactivated, false otherwise.
   */
  async deactivateUser(
    id: string,
    reason: string,
    correlationId: string,
  ): Promise<boolean> {
    const response = await this.client.requestRaw(
      ApiRequestMethod.POST,
      `/users/${id}/deactivate`,
      {
        correlationId,
        body: {
          reason,
        },
      },
    );

    try {
      const body = await response.text();
      return body === "true";
    } catch (error) {
      return Promise.reject(
        new Error(
          `deactivateUser response body text parse failed "${error.message}"`,
        ),
      );
    }
  }

  /**
   * Deletes a user code, such as a password reset code, from a user account.
   *
   * @param id - The ID of the user to delete a code from.
   * @param correlationId - Correlation ID to be passed with the request.
   * @returns true if the user's code was successfully deleted, false otherwise.
   */
  async deleteUserCode(id: string, correlationId: string): Promise<boolean> {
    const response = await this.client.requestRaw(
      ApiRequestMethod.DELETE,
      `/userCodes/${id}`,
      {
        correlationId,
      },
    );
    return response.status === 200;
  }
}
