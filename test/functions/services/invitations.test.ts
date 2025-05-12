import {
  deleteInvitationApiRecords,
  deleteInvitationDbRecords,
  getInvitationApiRecords,
} from "../../../src/functions/services/invitations";
import { Access } from "../../../src/infrastructure/api/dsiInternal/Access";
import { Organisations } from "../../../src/infrastructure/api/dsiInternal/Organisations";
import { Invitation } from "../../../src/infrastructure/database/directories/Invitation";
import { InvitationCallback } from "../../../src/infrastructure/database/directories/InvitationCallback";
import {
  generateInvitationOrganisations,
  generateInvitationServices,
} from "../../testUtils";

jest.mock("../../../src/infrastructure/api/dsiInternal/Access");
jest.mock("../../../src/infrastructure/api/dsiInternal/Organisations");
jest.mock("../../../src/infrastructure/database/directories/Invitation");
jest.mock(
  "../../../src/infrastructure/database/directories/InvitationCallback",
);

describe("Common invitation handling functions", () => {
  describe("getInvitationApiRecords", () => {
    const accessMock = jest.mocked(new Access());
    const organisationsMock = jest.mocked(new Organisations());
    const apiClients = {
      access: accessMock,
      organisations: organisationsMock,
    };

    beforeEach(() => {
      accessMock.getInvitationServices.mockResolvedValue([]);
      organisationsMock.getInvitationOrganisations.mockResolvedValue([]);
    });

    it("it attempts to retrieve the invitation's services using the invitation and correlation IDs", async () => {
      const invitationId = "test-inv";
      const correlationId = "test-correlation";
      await getInvitationApiRecords(apiClients, invitationId, correlationId);

      expect(accessMock.getInvitationServices).toHaveBeenCalled();
      expect(accessMock.getInvitationServices).toHaveBeenCalledWith(
        invitationId,
        correlationId,
      );
    });

    it("it attempts to retrieve the invitation's organisations using the invitation and correlation IDs", async () => {
      const invitationId = "test-inv";
      const correlationId = "test-correlation";
      await getInvitationApiRecords(apiClients, invitationId, correlationId);

      expect(organisationsMock.getInvitationOrganisations).toHaveBeenCalled();
      expect(organisationsMock.getInvitationOrganisations).toHaveBeenCalledWith(
        invitationId,
        correlationId,
      );
    });

    it.each([
      ["services", accessMock.getInvitationServices],
      ["organisations", organisationsMock.getInvitationOrganisations],
    ])(
      "it rejects with an array containing the error if the invitation %p API call rejects",
      async (name, method) => {
        const error = new Error(`Test Error ${name} API call`);
        method.mockRejectedValue(error);

        await expect(
          getInvitationApiRecords(apiClients, "", ""),
        ).rejects.toEqual([error]);
      },
    );

    it("it rejects with an array containing both errors if the invitation services and organisations API calls reject", async () => {
      const error = new Error("Test Error API call");
      accessMock.getInvitationServices.mockRejectedValue(error);
      organisationsMock.getInvitationOrganisations.mockRejectedValue(error);

      await expect(getInvitationApiRecords(apiClients, "", "")).rejects.toEqual(
        [error, error],
      );
    });

    it("it returns an empty array for invitation services, if none are found", async () => {
      accessMock.getInvitationServices.mockResolvedValue([]);
      const result = await getInvitationApiRecords(apiClients, "", "");

      expect(result.services).toEqual([]);
    });

    it("it returns an empty array for invitation organisations, if none are found", async () => {
      organisationsMock.getInvitationOrganisations.mockResolvedValue([]);
      const result = await getInvitationApiRecords(apiClients, "", "");

      expect(result.organisations).toEqual([]);
    });

    it("it returns an empty array for both invitation services and organisations, if none are found", async () => {
      accessMock.getInvitationServices.mockResolvedValue([]);
      organisationsMock.getInvitationOrganisations.mockResolvedValue([]);
      const result = await getInvitationApiRecords(apiClients, "", "");

      expect(result).toEqual({
        services: [],
        organisations: [],
      });
    });

    it("it returns the invitation services found without any modification, if some are found", async () => {
      const services = generateInvitationServices(2);
      accessMock.getInvitationServices.mockResolvedValue(services);
      const result = await getInvitationApiRecords(apiClients, "", "");

      expect(result.services).toEqual(services);
    });

    it("it returns the invitation organisations found without any modification, if some are found", async () => {
      const organisations = generateInvitationOrganisations(2);
      organisationsMock.getInvitationOrganisations.mockResolvedValue(
        organisations,
      );
      const result = await getInvitationApiRecords(apiClients, "", "");

      expect(result.organisations).toEqual(organisations);
    });

    it("it returns the invitation services and organisations found without any modification, if some are found", async () => {
      const services = generateInvitationServices(2);
      accessMock.getInvitationServices.mockResolvedValue(services);
      const organisations = generateInvitationOrganisations(2);
      organisationsMock.getInvitationOrganisations.mockResolvedValue(
        organisations,
      );
      const result = await getInvitationApiRecords(apiClients, "", "");

      expect(result).toEqual({
        services,
        organisations,
      });
    });
  });

  describe("deleteInvitationApiRecords", () => {
    const accessMock = jest.mocked(new Access());
    const organisationsMock = jest.mocked(new Organisations());
    const apiClients = {
      access: accessMock,
      organisations: organisationsMock,
    };

    beforeEach(() => {
      accessMock.deleteInvitationService.mockResolvedValue(true);
      organisationsMock.deleteInvitationOrganisation.mockResolvedValue(true);
    });

    it("it attempts to delete all invitation services if any records are passed in", async () => {
      const invitationId = "test-inv";
      const correlationId = "test-correlation";
      const services = generateInvitationServices(2);
      await deleteInvitationApiRecords(
        apiClients,
        invitationId,
        {
          services,
          organisations: [],
        },
        correlationId,
      );

      expect(accessMock.deleteInvitationService).toHaveBeenCalledTimes(2);
      expect(accessMock.deleteInvitationService).toHaveBeenCalledWith(
        invitationId,
        services[0].serviceId,
        services[0].organisationId,
        correlationId,
      );
      expect(accessMock.deleteInvitationService).toHaveBeenCalledWith(
        invitationId,
        services[1].serviceId,
        services[1].organisationId,
        correlationId,
      );
    });

    it("it doesn't attempt to delete invitation services if no records are passed in", async () => {
      await deleteInvitationApiRecords(
        apiClients,
        "",
        {
          services: [],
          organisations: [],
        },
        "",
      );

      expect(accessMock.deleteInvitationService).not.toHaveBeenCalled();
    });

    it("it attempts to delete all invitation organisations if any records are passed in", async () => {
      const invitationId = "test-inv";
      const correlationId = "test-correlation";
      const organisations = generateInvitationOrganisations(2);
      await deleteInvitationApiRecords(
        apiClients,
        invitationId,
        {
          services: [],
          organisations,
        },
        correlationId,
      );

      expect(
        organisationsMock.deleteInvitationOrganisation,
      ).toHaveBeenCalledTimes(2);
      expect(
        organisationsMock.deleteInvitationOrganisation,
      ).toHaveBeenCalledWith(
        invitationId,
        organisations[0].organisation.id,
        correlationId,
      );
      expect(
        organisationsMock.deleteInvitationOrganisation,
      ).toHaveBeenCalledWith(
        invitationId,
        organisations[1].organisation.id,
        correlationId,
      );
    });

    it("it doesn't attempt to delete all invitation organisations if no records are passed in", async () => {
      await deleteInvitationApiRecords(
        apiClients,
        "",
        {
          services: [],
          organisations: [],
        },
        "",
      );

      expect(
        organisationsMock.deleteInvitationOrganisation,
      ).not.toHaveBeenCalled();
    });

    it("it returns an object with the invitation ID and true for success if all deletion requests are successful", async () => {
      const invitationId = "test-inv";
      const result = await deleteInvitationApiRecords(
        apiClients,
        invitationId,
        {
          services: generateInvitationServices(2),
          organisations: generateInvitationOrganisations(2),
        },
        "",
      );

      expect(result).toEqual({
        object: invitationId,
        success: true,
      });
    });

    it("it returns an object with the invitation ID and true for success if no service/organisation records are passed in", async () => {
      const invitationId = "test-inv";
      const result = await deleteInvitationApiRecords(
        apiClients,
        invitationId,
        {
          services: [],
          organisations: [],
        },
        "",
      );

      expect(result).toEqual({
        object: invitationId,
        success: true,
      });
    });

    it("it returns an object with the invitation ID and false for success if some service deletion requests fail", async () => {
      const invitationId = "test-inv";
      accessMock.deleteInvitationService.mockResolvedValueOnce(false);
      accessMock.deleteInvitationService.mockResolvedValueOnce(false);
      accessMock.deleteInvitationService.mockResolvedValue(true);
      const result = await deleteInvitationApiRecords(
        apiClients,
        invitationId,
        {
          services: generateInvitationServices(4),
          organisations: [],
        },
        "",
      );

      expect(result).toEqual({
        object: invitationId,
        success: false,
      });
    });

    it("it returns an object with the invitation ID and false for success if some organisation deletion requests fail", async () => {
      const invitationId = "test-inv";
      organisationsMock.deleteInvitationOrganisation.mockResolvedValueOnce(
        false,
      );
      organisationsMock.deleteInvitationOrganisation.mockResolvedValueOnce(
        false,
      );
      organisationsMock.deleteInvitationOrganisation.mockResolvedValue(true);
      const result = await deleteInvitationApiRecords(
        apiClients,
        invitationId,
        {
          services: [],
          organisations: generateInvitationOrganisations(4),
        },
        "",
      );

      expect(result).toEqual({
        object: invitationId,
        success: false,
      });
    });

    it("it returns an object with the invitation ID and false for success if all deletion requests fail", async () => {
      const invitationId = "test-inv";
      accessMock.deleteInvitationService.mockResolvedValue(true);
      organisationsMock.deleteInvitationOrganisation.mockResolvedValue(false);
      const result = await deleteInvitationApiRecords(
        apiClients,
        invitationId,
        {
          services: generateInvitationServices(4),
          organisations: generateInvitationOrganisations(4),
        },
        "",
      );

      expect(result).toEqual({
        object: invitationId,
        success: false,
      });
    });

    it("it rejects with an array of returned errors from any rejected service deletion requests", async () => {
      const error1 = new Error("Test API Error 1");
      const error2 = new Error("Test API Error 2");
      accessMock.deleteInvitationService.mockRejectedValueOnce(error1);
      accessMock.deleteInvitationService.mockRejectedValueOnce(error2);

      await expect(
        deleteInvitationApiRecords(
          apiClients,
          "",
          {
            services: generateInvitationServices(2),
            organisations: [],
          },
          "",
        ),
      ).rejects.toEqual([error1, error2]);
    });

    it("it rejects with an array of returned errors from any rejected organisation deletion requests", async () => {
      const error1 = new Error("Test API Error 1");
      const error2 = new Error("Test API Error 2");
      organisationsMock.deleteInvitationOrganisation.mockRejectedValueOnce(
        error1,
      );
      organisationsMock.deleteInvitationOrganisation.mockRejectedValueOnce(
        error2,
      );

      await expect(
        deleteInvitationApiRecords(
          apiClients,
          "",
          {
            services: [],
            organisations: generateInvitationOrganisations(2),
          },
          "",
        ),
      ).rejects.toEqual([error1, error2]);
    });

    it("it rejects with an array of all errors returned from any rejected deletion requests", async () => {
      const error1 = new Error("Test API Error 1");
      const error2 = new Error("Test API Error 2");
      accessMock.deleteInvitationService.mockRejectedValueOnce(error1);
      accessMock.deleteInvitationService.mockRejectedValueOnce(error2);
      organisationsMock.deleteInvitationOrganisation.mockRejectedValueOnce(
        error1,
      );
      organisationsMock.deleteInvitationOrganisation.mockRejectedValueOnce(
        error2,
      );

      await expect(
        deleteInvitationApiRecords(
          apiClients,
          "",
          {
            services: generateInvitationServices(2),
            organisations: generateInvitationOrganisations(2),
          },
          "",
        ),
      ).rejects.toEqual([error1, error2, error1, error2]);
    });
  });

  describe("deleteInvitationDbRecords", () => {
    const invitationCallbackMock = jest.mocked(InvitationCallback);
    const invitationMock = jest.mocked(Invitation);

    it("it deletes all DB records for all invitations with successful API record deletions", async () => {
      const invitationIds = ["test1", "test2", "test3"];
      await deleteInvitationDbRecords(invitationIds);

      expect(invitationCallbackMock.destroy).toHaveBeenCalledWith({
        where: {
          invitationId: invitationIds,
        },
      });
      expect(invitationMock.destroy).toHaveBeenCalledWith({
        where: {
          id: invitationIds,
        },
      });
    });

    it.each([
      ["InvitationCallback", invitationCallbackMock],
      ["Invitation", invitationMock],
    ])(
      "it rejects with an error if any of the DB deletion queries throw an error (%p)",
      async (name, mock) => {
        const errorMessage = `Test Error Query ${name}`;
        mock.destroy.mockImplementation(() => {
          throw new Error(errorMessage);
        });

        await expect(deleteInvitationDbRecords([])).rejects.toEqual(
          new Error(errorMessage),
        );
      },
    );
  });
});
