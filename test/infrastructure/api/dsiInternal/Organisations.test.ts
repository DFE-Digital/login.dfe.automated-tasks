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
    const setRequestRawResponse = (text?: string | null) => {
      internalClient.prototype.requestRaw.mockResolvedValue({
        text: () => Promise.resolve(text),
      } as Response);
    };
    const setRequestResponse = (object: Object) => {
      internalClient.prototype.request.mockResolvedValue(object);
    };
    let organisations: Organisations;

    // beforeEach(() => {
    //   setRequestRawResponse("");
    //   setRequestResponse({});
    //   organisations = new Organisations();
    // });
  });
});
