import {
  ApiName,
  DsiInternalApiClient,
} from "../../../../src/infrastructure/api/dsiInternal/DsiInternalApiClient";
import { Applications } from "../../../../src/infrastructure/api/dsiInternal/Applications";
import { ApiRequestMethod } from "../../../../src/infrastructure/api/common/ApiClient";

jest.mock(
  "../../../../src/infrastructure/api/dsiInternal/DsiInternalApiClient",
);

describe("Applications API wrapper", () => {
  const internalClient = jest.mocked(DsiInternalApiClient);

  describe("When creating an Applications API wrapper", () => {
    it("it creates an internal client for the applications API", () => {
      new Applications();

      expect(internalClient).toHaveBeenCalled();
      expect(internalClient).toHaveBeenCalledWith(ApiName.Applications);
    });

    it("re-throws any error the internal client throws for missing environment variables", () => {
      const errorMessage = "This is a test error";
      internalClient.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      expect(() => new Applications()).toThrow(errorMessage);
    });
  });

  describe("Applications API functions", () => {
    const setRequestResponse = (object: object | null) => {
      internalClient.prototype.request.mockResolvedValue(object);
    };
    let applications: Applications;

    beforeEach(() => {
      setRequestResponse({});
      applications = new Applications();
    });

    describe("getServiceById", () => {
      it("it calls request using the GET method", async () => {
        await applications.getServiceById("svc-1", "correlation");

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][0]).toEqual(
          ApiRequestMethod.GET,
        );
      });

      it("it calls request to the correct path with the passed service ID", async () => {
        const serviceId = "test-123";
        await applications.getServiceById(serviceId, "");

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][1]).toEqual(
          `/services/${serviceId}`,
        );
      });

      it("it calls request with the passed correlation ID", async () => {
        const correlationId = "test-123";
        await applications.getServiceById("", correlationId);

        expect(internalClient.prototype.request).toHaveBeenCalled();
        expect(internalClient.prototype.request.mock.calls[0][2]).toEqual({
          correlationId,
        });
      });

      it("it returns null if the service is not found", async () => {
        setRequestResponse(null);

        expect(await applications.getServiceById("", "")).toBeNull();
      });

      it("it rejects with request's error if request rejects", async () => {
        expect.hasAssertions();
        const errorMessage = "This is a test error";
        internalClient.prototype.request.mockRejectedValue(
          new Error(errorMessage),
        );

        try {
          await applications.getServiceById("", "");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty("message", errorMessage);
        }
      });
    });
  });
});
