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
    const setRequestResponse = (object: Object) => {
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

      it("it re-throws any errors thrown by requestRaw", async () => {
        const errorMessage = "This is a test error";
        internalClient.prototype.requestRaw.mockImplementation(() => {
          throw new Error(errorMessage);
        });

        expect(directories.deactivateUser("", "")).rejects.toThrow(errorMessage);
      });
    });
  });
});
