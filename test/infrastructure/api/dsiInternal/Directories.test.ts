import { ApiRequestMethod } from "../../../../src/infrastructure/api/common/ApiClient";
import {
  ApiName,
  DsiInternalApiClient,
} from "../../../../src/infrastructure/api/dsiInternal/DsiInternalApiClient";
import { Directories } from "../../../../src/infrastructure/api/dsiInternal/Directories";

jest.mock(
  "../../../../src/infrastructure/api/dsiInternal/DsiInternalApiClient",
);

describe("Directories API wrapper", () => {
  const internalClient = jest.mocked(DsiInternalApiClient);

  describe("When creating a Directories API wrapper", () => {
    it("it creates an internal client for the directories API", () => {
      new Directories();

      expect(internalClient).toHaveBeenCalled();
      expect(internalClient).toHaveBeenCalledWith(ApiName.Directories);
    });

    it("re-throws any error the internal client throws for missing environment variables", () => {
      const errorMessage = "This is a test error";
      internalClient.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      expect(() => new Directories()).toThrow(errorMessage);
    });
  });

  describe("Directories API functions", () => {
    const setRequestRawResponse = (text?: string | null) => {
      internalClient.prototype.requestRaw.mockResolvedValue({
        text: () => Promise.resolve(text),
      } as Response);
    };
    const setRequestResponse = (object: object | null) => {
      internalClient.prototype.request.mockResolvedValue(object);
    };
    let directories: Directories;

    beforeEach(() => {
      setRequestRawResponse("");
      setRequestResponse({});
      directories = new Directories();
    });

    describe("getUsersByIds", () => {
      it("it calls request using the POST method", async () => {
        await directories.getUsersByIds(["test"], "correlation");

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][0]).toEqual(
          ApiRequestMethod.POST,
        );
      });

      it("it rejects with an error if no user IDs are passed", async () => {
        expect.hasAssertions();
        try {
          await directories.getUsersByIds([], "");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty(
            "message",
            `getUsersByIds must be called with at least one user ID`,
          );
        }
      });

      it("it calls request to the correct path", async () => {
        await directories.getUsersByIds(["test"], "");

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][1]).toEqual(
          `/users/by-ids`,
        );
      });

      it("it calls request with the passed correlation ID", async () => {
        const correlationId = "test-123";
        await directories.getUsersByIds(["test"], correlationId);

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(
          internalClient.prototype.request.mock.calls[0][2],
        ).toHaveProperty("correlationId", correlationId);
      });

      it("it calls request with the passed user IDs in the body joined by commas", async () => {
        const userIds = ["test1", "test2", "test3"];
        await directories.getUsersByIds(userIds, "");

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(
          internalClient.prototype.request.mock.calls[0][2],
        ).toHaveProperty("body", {
          ids: userIds.join(","),
        });
      });

      it("it returns an empty array if request returns null", async () => {
        setRequestResponse(null);

        expect(await directories.getUsersByIds(["test"], "")).toEqual([]);
      });

      it("it rejects with request's error if request rejects", async () => {
        expect.hasAssertions();
        const errorMessage = "This is a test error";
        internalClient.prototype.request.mockRejectedValue(
          new Error(errorMessage),
        );

        try {
          await directories.getUsersByIds(["test"], "");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty("message", errorMessage);
        }
      });
    });

    describe("deactivateUser", () => {
      it("it calls requestRaw using the POST method", async () => {
        await directories.deactivateUser("user", "reason", "correlation");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][0]).toEqual(
          ApiRequestMethod.POST,
        );
      });

      it("it calls requestRaw to the /users/ID/deactivate path with the passed user ID", async () => {
        const userId = "test-123";
        await directories.deactivateUser(userId, "reason", "");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][1]).toEqual(
          `/users/${userId}/deactivate`,
        );
      });

      it("it calls requestRaw with the passed correlation ID", async () => {
        const correlationId = "test-123";
        await directories.deactivateUser("", "reason", correlationId);

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][2]).toEqual({
          correlationId,
          body: {
            reason: "reason",
          },
        });
      });

      it("it rejects with any error returned by response text parsing", async () => {
        expect.hasAssertions();
        const errorMessage = "This is a test error";
        internalClient.prototype.requestRaw.mockResolvedValue({
          text: () => Promise.reject(new Error(errorMessage)),
        } as Response);

        try {
          await directories.deactivateUser("", "", "");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty(
            "message",
            `deactivateUser response body text parse failed "${errorMessage}"`,
          );
        }
      });

      it("it returns true if the response body's text is 'true'", async () => {
        setRequestRawResponse("true");

        expect(await directories.deactivateUser("", "", "")).toEqual(true);
      });

      it.each(["false", "", "123", null, undefined])(
        "it returns false if the response body's text is not 'true' (%p)",
        async (text) => {
          setRequestRawResponse(text);

          expect(await directories.deactivateUser("", "", "")).toEqual(false);
        },
      );

      it("it rejects with requestRaw's error if requestRaw rejects", async () => {
        expect.hasAssertions();
        const errorMessage = "This is a test error";
        internalClient.prototype.requestRaw.mockRejectedValue(
          new Error(errorMessage),
        );

        try {
          await directories.deactivateUser("", "", "");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty("message", errorMessage);
        }
      });
    });

    describe("deleteUserCode", () => {
      it("it calls requestRaw using the DELETE method", async () => {
        await directories.deleteUserCode("user", "correlation");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][0]).toEqual(
          ApiRequestMethod.DELETE,
        );
      });

      it("it calls requestRaw to the /userCodes/ID path with the passed user ID", async () => {
        const userId = "test-123";
        await directories.deleteUserCode(userId, "");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][1]).toEqual(
          `/userCodes/${userId}`,
        );
      });

      it("it calls requestRaw with the passed correlation ID", async () => {
        const correlationId = "test-123";
        await directories.deleteUserCode("", correlationId);

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][2]).toEqual({
          correlationId,
        });
      });

      it("it returns true if the response status is 200", async () => {
        internalClient.prototype.requestRaw.mockResolvedValue({
          status: 200,
        } as Response);

        expect(await directories.deleteUserCode("", "")).toEqual(true);
      });

      it.each([201, 202, 302, 304])(
        "it returns false if the response status is not 200 (%p)",
        async (status) => {
          internalClient.prototype.requestRaw.mockResolvedValue({
            status,
          } as Response);

          expect(await directories.deleteUserCode("", "")).toEqual(false);
        },
      );

      it("it rejects with requestRaw's error if requestRaw rejects", async () => {
        expect.hasAssertions();
        const errorMessage = "This is a test error";
        internalClient.prototype.requestRaw.mockRejectedValue(
          new Error(errorMessage),
        );

        try {
          await directories.deleteUserCode("", "");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty("message", errorMessage);
        }
      });
    });
  });
});
