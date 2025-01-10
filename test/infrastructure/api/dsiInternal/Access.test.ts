import { ApiName, DsiInternalApiClient } from "../../../../src/infrastructure/api/dsiInteral/DsiInternalApiClient";
import { Access } from "../../../../src/infrastructure/api/dsiInteral/Access";
import { ApiRequestMethod } from "../../../../src/infrastructure/api/common/ApiClient";

jest.mock("../../../../src/infrastructure/api/dsiInteral/DsiInternalApiClient");

describe("Access API wrapper", () => {
  const internalClient = jest.mocked(DsiInternalApiClient);

  describe("When creating a Access API wrapper", () => {
    it("it creates an internal client for the access API", () => {
      new Access();

      expect(internalClient).toHaveBeenCalled();
      expect(internalClient).toHaveBeenCalledWith(ApiName.Access);
    });

    it("re-throws any error the internal client throws for missing environment variables", () => {
      const errorMessage = "This is a test error";
      internalClient.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      expect(() => new Access).toThrow(errorMessage);
    });
  });

  describe("Access API functions", () => {
    const setRequestRawResponse = (status: Number = 200) => {
      internalClient.prototype.requestRaw.mockResolvedValue({
        status,
      } as Response);
    };
    const setRequestResponse = (object: Object | null) => {
      internalClient.prototype.request.mockResolvedValue(object);
    };
    let access: Access;

    beforeEach(() => {
      setRequestRawResponse();
      setRequestResponse({});
      access = new Access();
    });

    describe("deleteInvitationService", () => {
      it("it calls requestRaw using the DELETE method", async () => {
        await access.deleteInvitationService("inv-1", "svc-1", "org-1", "correlation");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][0]).toEqual(ApiRequestMethod.DELETE);
      });

      it("it calls requestRaw to the correct path with the passed invitation, service & org IDs", async () => {
        const invId = "test-123";
        const svcId = "service-123";
        const orgId = "org-123";
        await access.deleteInvitationService(invId, svcId, orgId, "");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][1]).toEqual(
          `/invitations/${invId}/services/${svcId}/organisations/${orgId}`
        );
      });

      it("it calls requestRaw with the passed correlation ID", async () => {
        const correlationId = "test-123";
        await access.deleteInvitationService("", "", "", correlationId);

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][2]).toEqual({
          correlationId,
        });
      });

      it("it returns true if the response status is 204", async () => {
        setRequestRawResponse(204);

        expect(await access.deleteInvitationService("", "", "", "")).toEqual(true);
      });

      it.each([
        201,
        202,
        302,
        304,
      ])("it returns false if the response status is not 204 (%p)", async (status) => {
        setRequestRawResponse(status);

        expect(await access.deleteInvitationService("", "", "", "")).toEqual(false);
      });

      it("it re-throws any errors thrown by requestRaw", async () => {
        const errorMessage = "This is a test error";
        internalClient.prototype.requestRaw.mockImplementation(() => {
          throw new Error(errorMessage);
        });

        expect(access.deleteInvitationService("", "", "", "")).rejects.toThrow(errorMessage);
      });
    });

    describe("deleteUserService", () => {
      it("it calls requestRaw using the DELETE method", async () => {
        await access.deleteUserService("user-1", "svc-1", "org-1", "correlation");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][0]).toEqual(ApiRequestMethod.DELETE);
      });

      it("it calls requestRaw to the correct path with the passed user, service & org IDs", async () => {
        const userId = "test-123";
        const svcId = "service-123";
        const orgId = "org-123";
        await access.deleteUserService(userId, svcId, orgId, "");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][1]).toEqual(
          `/users/${userId}/services/${svcId}/organisations/${orgId}`
        );
      });

      it("it calls requestRaw with the passed correlation ID", async () => {
        const correlationId = "test-123";
        await access.deleteUserService("", "", "", correlationId);

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][2]).toEqual({
          correlationId,
        });
      });

      it("it returns true if the response status is 204", async () => {
        setRequestRawResponse(204);

        expect(await access.deleteUserService("", "", "", "")).toEqual(true);
      });

      it.each([
        201,
        202,
        302,
        304,
      ])("it returns false if the response status is not 204 (%p)", async (status) => {
        setRequestRawResponse(status);

        expect(await access.deleteUserService("", "", "", "")).toEqual(false);
      });

      it("it re-throws any errors thrown by requestRaw", async () => {
        const errorMessage = "This is a test error";
        internalClient.prototype.requestRaw.mockImplementation(() => {
          throw new Error(errorMessage);
        });

        expect(access.deleteUserService("", "", "", "")).rejects.toThrow(errorMessage);
      });
    });
  });
});
