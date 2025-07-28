import { ApiRequestMethod } from "../../../../src/infrastructure/api/common/ApiClient";
import {
  ApiName,
  DsiInternalApiClient,
} from "../../../../src/infrastructure/api/dsiInternal/DsiInternalApiClient";
import { Organisations } from "../../../../src/infrastructure/api/dsiInternal/Organisations";

jest.mock(
  "../../../../src/infrastructure/api/dsiInternal/DsiInternalApiClient",
);

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

      expect(() => new Organisations()).toThrow(errorMessage);
    });
  });

  describe("Organisations API functions", () => {
    const setRequestRawResponse = (status: number = 200) => {
      internalClient.prototype.requestRaw.mockResolvedValue({
        status,
      } as Response);
    };
    const setRequestResponse = (object: object | null) => {
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
        expect(internalClient.prototype.request.mock.calls[0][0]).toEqual(
          ApiRequestMethod.GET,
        );
      });

      it("it calls request to the correct path with the passed invitation ID", async () => {
        const invId = "test-123";
        await organisations.getInvitationOrganisations(invId, "");

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][1]).toEqual(
          `/invitations/v2/${invId}`,
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

        expect(await organisations.getInvitationOrganisations("", "")).toEqual(
          [],
        );
      });

      it("it rejects with request's error if request rejects", async () => {
        expect.hasAssertions();
        const errorMessage = "This is a test error";
        internalClient.prototype.request.mockRejectedValue(
          new Error(errorMessage),
        );

        try {
          await organisations.getInvitationOrganisations("", "");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty("message", errorMessage);
        }
      });
    });

    describe("getOrganisationRequestPage", () => {
      it("it calls request using the GET method", async () => {
        await organisations.getOrganisationRequestPage(1, "correlation");

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][0]).toEqual(
          ApiRequestMethod.GET,
        );
      });

      it("it calls request to the correct path with the passed page number if no statuses are passed in", async () => {
        const page = 1;
        await organisations.getOrganisationRequestPage(page, "correlation");

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][1]).toEqual(
          `/organisations/requests?page=${page}`,
        );
      });

      it("it calls request to the correct path with the passed page number and status if one is passed in", async () => {
        const page = 1;
        const status = 1;
        await organisations.getOrganisationRequestPage(page, "correlation", [
          status,
        ]);

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][1]).toEqual(
          `/organisations/requests?page=${page}&filterstatus=${status}`,
        );
      });

      it("it calls request to the correct path with the passed page number and statuses if multiple are passed in", async () => {
        const page = 1;
        const statuses = [1, 2];
        await organisations.getOrganisationRequestPage(
          page,
          "correlation",
          statuses,
        );

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][1]).toEqual(
          `/organisations/requests?page=${page}&filterstatus=${statuses[0]}&filterstatus=${statuses[1]}`,
        );
      });

      it("it calls request with the passed correlation ID", async () => {
        const correlationId = "test-123";
        await organisations.getOrganisationRequestPage(1, correlationId);

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][2]).toEqual({
          correlationId,
        });
      });

      it("it returns an empty page if request returns null", async () => {
        setRequestResponse(null);

        expect(await organisations.getOrganisationRequestPage(2, "")).toEqual({
          requests: [],
          page: 2,
          totalNumberOfPages: 0,
          totalNumberOfRecords: 0,
        });
      });

      it("it rejects with request's error if request rejects", async () => {
        expect.hasAssertions();
        const errorMessage = "This is a test error";
        internalClient.prototype.request.mockRejectedValue(
          new Error(errorMessage),
        );

        try {
          await organisations.getOrganisationRequestPage(1, "");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty("message", errorMessage);
        }
      });
    });

    describe("getUserOrganisations", () => {
      it("it calls request using the GET method", async () => {
        await organisations.getUserOrganisations("user-1", "correlation");

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][0]).toEqual(
          ApiRequestMethod.GET,
        );
      });

      it("it calls request to the correct path with the passed user ID", async () => {
        const userId = "test-123";
        await organisations.getUserOrganisations(userId, "");

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][1]).toEqual(
          `/organisations/v2/associated-with-user/${userId}`,
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

      it("it rejects with request's error if request rejects", async () => {
        expect.hasAssertions();
        const errorMessage = "This is a test error";
        internalClient.prototype.request.mockRejectedValue(
          new Error(errorMessage),
        );

        try {
          await organisations.getUserOrganisations("", "");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty("message", errorMessage);
        }
      });
    });

    describe("updateOrganisationRequest", () => {
      it("it calls requestRaw using the PATCH method", async () => {
        await organisations.updateOrganisationRequest(
          "req-1",
          {},
          "correlation",
        );

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][0]).toEqual(
          ApiRequestMethod.PATCH,
        );
      });

      it("it calls requestRaw to the correct path with the passed request ID", async () => {
        const reqId = "test-123";
        await organisations.updateOrganisationRequest(reqId, {}, "");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][1]).toEqual(
          `/organisations/requests/${reqId}`,
        );
      });

      it("it calls requestRaw with the passed correlation ID", async () => {
        const correlationId = "test-123";
        await organisations.updateOrganisationRequest("", {}, correlationId);

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(
          internalClient.prototype.requestRaw.mock.calls[0][2],
        ).toHaveProperty("correlationId", correlationId);
      });

      it("it calls requestRaw with an empty object body if no properties are passed in", async () => {
        await organisations.updateOrganisationRequest("", {}, "");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(
          internalClient.prototype.requestRaw.mock.calls[0][2],
        ).toHaveProperty("body", {});
      });

      it("it calls requestRaw with an object body only containing the properties passed in", async () => {
        const properties = {
          status: -1,
          actioned_at: Date.now(),
        };
        await organisations.updateOrganisationRequest("", properties, "");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(
          internalClient.prototype.requestRaw.mock.calls[0][2],
        ).toHaveProperty("body", properties);
      });

      it("it returns true if the response status is 202", async () => {
        setRequestRawResponse(202);

        expect(
          await organisations.updateOrganisationRequest("", {}, ""),
        ).toEqual(true);
      });

      it.each([201, 204, 302, 304])(
        "it returns false if the response status is not 202 (%p)",
        async (status) => {
          setRequestRawResponse(status);

          expect(
            await organisations.updateOrganisationRequest("", {}, ""),
          ).toEqual(false);
        },
      );

      it("it rejects with requestRaw's error if requestRaw rejects", async () => {
        expect.hasAssertions();
        const errorMessage = "This is a test error";
        internalClient.prototype.requestRaw.mockRejectedValue(
          new Error(errorMessage),
        );

        try {
          await organisations.updateOrganisationRequest("", {}, "");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty("message", errorMessage);
        }
      });
    });

    describe("deleteInvitationOrganisation", () => {
      it("it calls requestRaw using the DELETE method", async () => {
        await organisations.deleteInvitationOrganisation(
          "inv-1",
          "org-1",
          "correlation",
        );

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][0]).toEqual(
          ApiRequestMethod.DELETE,
        );
      });

      it("it calls requestRaw to the correct path with the passed invitation & org IDs", async () => {
        const invId = "test-123";
        const orgId = "org-123";
        await organisations.deleteInvitationOrganisation(invId, orgId, "");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][1]).toEqual(
          `/organisations/${orgId}/invitations/${invId}`,
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

        expect(
          await organisations.deleteInvitationOrganisation("", "", ""),
        ).toEqual(true);
      });

      it.each([201, 202, 302, 304])(
        "it returns false if the response status is not 204 (%p)",
        async (status) => {
          setRequestRawResponse(status);

          expect(
            await organisations.deleteInvitationOrganisation("", "", ""),
          ).toEqual(false);
        },
      );

      it("it rejects with requestRaw's error if requestRaw rejects", async () => {
        expect.hasAssertions();
        const errorMessage = "This is a test error";
        internalClient.prototype.requestRaw.mockRejectedValue(
          new Error(errorMessage),
        );

        try {
          await organisations.deleteInvitationOrganisation("", "", "");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty("message", errorMessage);
        }
      });
    });

    describe("deleteUserOrganisation", () => {
      it("it calls requestRaw using the DELETE method", async () => {
        await organisations.deleteUserOrganisation(
          "user-1",
          "org-1",
          "correlation",
        );

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][0]).toEqual(
          ApiRequestMethod.DELETE,
        );
      });

      it("it calls requestRaw to the correct path with the passed user & org IDs", async () => {
        const userId = "test-123";
        const orgId = "org-123";
        await organisations.deleteUserOrganisation(userId, orgId, "");

        expect(internalClient.prototype.requestRaw).toHaveBeenCalled();
        expect(internalClient.prototype.requestRaw.mock.calls[0][1]).toEqual(
          `/organisations/${orgId}/users/${userId}`,
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

        expect(await organisations.deleteUserOrganisation("", "", "")).toEqual(
          true,
        );
      });

      it.each([201, 202, 302, 304])(
        "it returns false if the response status is not 204 (%p)",
        async (status) => {
          setRequestRawResponse(status);

          expect(
            await organisations.deleteUserOrganisation("", "", ""),
          ).toEqual(false);
        },
      );

      it("it rejects with requestRaw's error if requestRaw rejects", async () => {
        expect.hasAssertions();
        const errorMessage = "This is a test error";
        internalClient.prototype.requestRaw.mockRejectedValue(
          new Error(errorMessage),
        );

        try {
          await organisations.deleteUserOrganisation("", "", "");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty("message", errorMessage);
        }
      });
    });
  });
});
