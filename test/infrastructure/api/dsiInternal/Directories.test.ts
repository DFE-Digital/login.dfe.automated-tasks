import { ApiRequestMethod } from "../../../../src/infrastructure/api/common/ApiClient";
import { ApiName, DsiInternalApiClient } from "../../../../src/infrastructure/api/dsiInteral/DsiInternalApiClient";
import { Directories } from "../../../../src/infrastructure/api/dsiInteral/Directories";

jest.mock("../../../../src/infrastructure/api/dsiInteral/DsiInternalApiClient");

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

      expect(() => new Directories).toThrow(errorMessage);
    });
  });

  describe("Directories API functions", () => {
    const setRequestRawResponse = (text?: string | null) => {
      internalClient.prototype.requestRaw.mockResolvedValue({
        text: () => Promise.resolve(text),
      } as Response);
    };
    const setRequestResponse = (object: Object | null) => {
      internalClient.prototype.request.mockResolvedValue(object);
    };
    let directories: Directories;

    beforeEach(() => {
      setRequestRawResponse("");
      setRequestResponse({});
      directories = new Directories();
    });

    describe("deactivateUser", () => {
      it("it calls requestRaw using the POST method", async () => {
        await directories.deactivateUser("user", "correlation");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][0]).toEqual(ApiRequestMethod.POST);
      });

      it("it calls requestRaw to the /users/ID/deactivate path with the passed user ID", async () => {
        const userId = "test-123";
        await directories.deactivateUser(userId, "");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][1]).toEqual(`/users/${userId}/deactivate`);
      });

      it("it calls requestRaw with the passed correlation ID", async () => {
        const correlationId = "test-123";
        await directories.deactivateUser("", correlationId);

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][2]).toEqual({
          correlationId
        });
      });

      it("it rejects with any error returned by response text parsing", async () => {
        const errorMessage = "This is a test error";
        internalClient.prototype.requestRaw.mockResolvedValue({
          text: () => Promise.reject(new Error(errorMessage)),
        } as Response);

        try {
          await directories.deactivateUser("", "");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty(
            "message",
            `deactivateUser response body text parse failed "${errorMessage}"`
          );
        }
      });

      it("it returns true if the response body's text is 'true'", async () => {
        setRequestRawResponse("true");

        expect(await directories.deactivateUser("", "")).toEqual(true);
      });

      it.each([
        "false",
        "",
        "123",
        null,
        undefined
      ])("it returns false if the response body's text is not 'true' (%p)", async (text) => {
        setRequestRawResponse(text);

        expect(await directories.deactivateUser("", "")).toEqual(false);
      });

      it("it rejects with requestRaw's error if requestRaw rejects", async () => {
        const errorMessage = "This is a test error";
        internalClient.prototype.requestRaw.mockRejectedValue(new Error(errorMessage));

        try {
          await directories.deactivateUser("", "");
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
        expect(internalClient.prototype.requestRaw.mock.calls[0][0]).toEqual(ApiRequestMethod.DELETE);
      });

      it("it calls requestRaw to the /userCodes/ID path with the passed user ID", async () => {
        const userId = "test-123";
        await directories.deleteUserCode(userId, "");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][1]).toEqual(`/userCodes/${userId}`);
      });

      it("it calls requestRaw with the passed correlation ID", async () => {
        const correlationId = "test-123";
        await directories.deleteUserCode("", correlationId);

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][2]).toEqual({
          correlationId
        });
      });

      it("it returns true if the response status is 200", async () => {
        internalClient.prototype.requestRaw.mockResolvedValue({
          status: 200,
        } as Response);

        expect(await directories.deleteUserCode("", "")).toEqual(true);
      });

      it.each([
        201,
        202,
        302,
        304,
      ])("it returns false if the response status is not 200 (%p)", async (status) => {
        internalClient.prototype.requestRaw.mockResolvedValue({
          status,
        } as Response);

        expect(await directories.deleteUserCode("", "")).toEqual(false);
      });

      it("it rejects with requestRaw's error if requestRaw rejects", async () => {
        const errorMessage = "This is a test error";
        internalClient.prototype.requestRaw.mockRejectedValue(new Error(errorMessage));

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
