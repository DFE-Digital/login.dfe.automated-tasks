import { ApiRequestMethod } from "../../../../src/infrastructure/api/common/ApiClient";
import { ApiName, DsiInternalApiClient } from "../../../../src/infrastructure/api/dsiInteral/DsiInternalApiClient";
import { Organisations } from "../../../../src/infrastructure/api/dsiInteral/Organisations";

jest.mock("../../../../src/infrastructure/api/dsiInteral/DsiInternalApiClient");

describe("Organisations API wrapper", () => {
  const internalClient = jest.mocked(DsiInternalApiClient);

  describe("When creating a Organisations API wrapper", () => {
    it("it creates an internal client for the organisations API", () => {
      new Organisations();

      expect(internalClient).toHaveBeenCalled();
      expect(internalClient).toHaveBeenCalledWith(ApiName.Organisations);
    });

    it("re-throws any error the internal client throws for missing environment variables", () => {
      const errorMessage = "This is a test error";
      internalClient.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      expect(() => new Organisations).toThrow(errorMessage);
    });
  });

  describe("Organisations API functions", () => {
    const setRequestRawResponse = (status: Number = 200) => {
      internalClient.prototype.requestRaw.mockResolvedValue({
        status,
      } as Response);
    };
    const setRequestResponse = (object: Object | null) => {
      internalClient.prototype.request.mockResolvedValue(object);
    };
    let organisations: Organisations;

    beforeEach(() => {
      setRequestRawResponse();
      setRequestResponse({});
      organisations = new Organisations();
    });

    describe("getInvitationOrganisations", () => {
      it("it calls request using the GET method", async () => {
        await organisations.getInvitationOrganisations("inv-1", "correlation");

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][0]).toEqual(ApiRequestMethod.GET);
      });

      it("it calls request to the correct path with the passed invitation ID", async () => {
        const invId = "test-123";
        await organisations.getInvitationOrganisations(invId, "");

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][1]).toEqual(
          `/invitations/v2/${invId}`
        );
      });

      it("it calls request with the passed correlation ID", async () => {
        const correlationId = "test-123";
        await organisations.getInvitationOrganisations("", correlationId);

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][2]).toEqual({
          correlationId,
        });
      });

      it("it returns an empty array if request returns null", async () => {
        setRequestResponse(null);

        expect(await organisations.getInvitationOrganisations("", "")).toEqual([]);
      });

      it("it re-throws any errors thrown by request", async () => {
        const errorMessage = "This is a test error";
        internalClient.prototype.request.mockImplementation(() => {
          throw new Error(errorMessage);
        });

        expect(organisations.getInvitationOrganisations("", "")).rejects.toThrow(errorMessage);
      });
    });

    describe("getUserOrganisations", () => {
      it("it calls request using the GET method", async () => {
        await organisations.getUserOrganisations("user-1", "correlation");

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][0]).toEqual(ApiRequestMethod.GET);
      });

      it("it calls request to the correct path with the passed user ID", async () => {
        const userId = "test-123";
        await organisations.getUserOrganisations(userId, "");

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][1]).toEqual(
          `/organisations/v2/associated-with-user/${userId}`
        );
      });

      it("it calls request with the passed correlation ID", async () => {
        const correlationId = "test-123";
        await organisations.getUserOrganisations("", correlationId);

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][2]).toEqual({
          correlationId,
        });
      });

      it("it returns an empty array if request returns null", async () => {
        setRequestResponse(null);

        expect(await organisations.getUserOrganisations("", "")).toEqual([]);
      });

      it("it re-throws any errors thrown by request", async () => {
        const errorMessage = "This is a test error";
        internalClient.prototype.request.mockImplementation(() => {
          throw new Error(errorMessage);
        });

        expect(organisations.getUserOrganisations("", "")).rejects.toThrow(errorMessage);
      });
    });

    describe("deleteInvitationOrganisation", () => {
      it("it calls requestRaw using the DELETE method", async () => {
        await organisations.deleteInvitationOrganisation("inv-1", "org-1", "correlation");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][0]).toEqual(ApiRequestMethod.DELETE);
      });

      it("it calls requestRaw to the correct path with the passed invitation & org IDs", async () => {
        const invId = "test-123";
        const orgId = "org-123";
        await organisations.deleteInvitationOrganisation(invId, orgId, "");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][1]).toEqual(
          `/organisations/${orgId}/invitations/${invId}`
        );
      });

      it("it calls requestRaw with the passed correlation ID", async () => {
        const correlationId = "test-123";
        await organisations.deleteInvitationOrganisation("", "", correlationId);

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][2]).toEqual({
          correlationId,
        });
      });

      it("it returns true if the response status is 204", async () => {
        setRequestRawResponse(204);

        expect(await organisations.deleteInvitationOrganisation("", "", "")).toEqual(true);
      });

      it.each([
        201,
        202,
        302,
        304,
      ])("it returns false if the response status is not 204 (%p)", async (status) => {
        setRequestRawResponse(status);

        expect(await organisations.deleteInvitationOrganisation("", "", "")).toEqual(false);
      });

      it("it re-throws any errors thrown by requestRaw", async () => {
        const errorMessage = "This is a test error";
        internalClient.prototype.requestRaw.mockImplementation(() => {
          throw new Error(errorMessage);
        });

        expect(organisations.deleteInvitationOrganisation("", "", "")).rejects.toThrow(errorMessage);
      });
    });

    describe("deleteUserOrganisation", () => {
      it("it calls requestRaw using the DELETE method", async () => {
        await organisations.deleteUserOrganisation("user-1", "org-1", "correlation");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][0]).toEqual(ApiRequestMethod.DELETE);
      });

      it("it calls requestRaw to the correct path with the passed user & org IDs", async () => {
        const userId = "test-123";
        const orgId = "org-123";
        await organisations.deleteUserOrganisation(userId, orgId, "");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][1]).toEqual(
          `/organisations/${orgId}/users/${userId}`
        );
      });

      it("it calls requestRaw with the passed correlation ID", async () => {
        const correlationId = "test-123";
        await organisations.deleteUserOrganisation("", "", correlationId);

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][2]).toEqual({
          correlationId,
        });
      });

      it("it returns true if the response status is 204", async () => {
        setRequestRawResponse(204);

        expect(await organisations.deleteUserOrganisation("", "", "")).toEqual(true);
      });

      it.each([
        201,
        202,
        302,
        304,
      ])("it returns false if the response status is not 204 (%p)", async (status) => {
        setRequestRawResponse(status);

        expect(await organisations.deleteUserOrganisation("", "", "")).toEqual(false);
      });

      it("it re-throws any errors thrown by requestRaw", async () => {
        const errorMessage = "This is a test error";
        internalClient.prototype.requestRaw.mockImplementation(() => {
          throw new Error(errorMessage);
        });

        expect(organisations.deleteUserOrganisation("", "", "")).rejects.toThrow(errorMessage);
      });
    });
  });
});
