import { ApiName, DsiInternalApiClient } from "../../../../src/infrastructure/api/dsiInteral/DsiInternalApiClient";
import { Access } from "../../../../src/infrastructure/api/dsiInteral/Access";

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
    const setRequestRawResponse = (text?: string | null) => {
      internalClient.prototype.requestRaw.mockResolvedValue({
        text: () => Promise.resolve(text),
      } as Response);
    };
    const setRequestResponse = (object: Object) => {
      internalClient.prototype.request.mockResolvedValue(object);
    };
    let access: Access;

    // beforeEach(() => {
    //   setRequestRawResponse("");
    //   setRequestResponse({});
    //   access = new Access();
    // });
  });
});
