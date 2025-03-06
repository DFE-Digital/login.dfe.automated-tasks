import { InvocationContext, Timer } from "@azure/functions";
import { Op, Sequelize } from "sequelize";
import { removeUnresolvedInvitations } from "../../src/functions/removeUnresolvedInvitations";
import { Access } from "../../src/infrastructure/api/dsiInternal/Access";
import { Organisations } from "../../src/infrastructure/api/dsiInternal/Organisations";
import { connection, DatabaseName } from "../../src/infrastructure/database/common/connection";
import { initialiseAllInvitationModels } from "../../src/infrastructure/database/common/utils";
import { Invitation } from "../../src/infrastructure/database/directories/Invitation";
import { InvitationCallback } from "../../src/infrastructure/database/directories/InvitationCallback";
import { generateInvitationOrganisations, generateInvitations, generateInvitationServices } from "../testUtils";

jest.mock("@azure/functions");
jest.mock("sequelize");
jest.mock("../../src/infrastructure/api/dsiInternal/Access");
jest.mock("../../src/infrastructure/api/dsiInternal/Organisations");
jest.mock("../../src/infrastructure/database/common/connection");
jest.mock("../../src/infrastructure/database/common/utils");
jest.mock("../../src/infrastructure/database/directories/Invitation");
jest.mock("../../src/infrastructure/database/directories/InvitationCallback");

describe("Remove unresolved invitations automated task", () => {
  const contextMock = jest.mocked(InvocationContext);
  const accessMock = jest.mocked(Access);
  const organisationsMock = jest.mocked(Organisations);
  const connectionMock = jest.mocked(connection);
  const invitationMock = jest.mocked(Invitation);
  const invitationCallbackMock = jest.mocked(InvitationCallback);

  beforeEach(() => {
    accessMock.prototype.getInvitationServices.mockResolvedValue([]);
    accessMock.prototype.deleteInvitationService.mockResolvedValue(true);
    organisationsMock.prototype.getInvitationOrganisations.mockResolvedValue([]);
    organisationsMock.prototype.deleteInvitationOrganisation.mockResolvedValue(true);
    invitationMock.findAll.mockResolvedValue([]);
  });

  it.each([
    ["Access", accessMock],
    ["Organisations", organisationsMock],
  ])("it throws an error if any of the APIs throw an error on instantiation (%p)", async (name, mock) => {
    const errorMessage = `Test Error ${name}`;
    mock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(removeUnresolvedInvitations({} as Timer, new InvocationContext()))
      .rejects
      .toThrow(`removeUnresolvedInvitations: ${errorMessage}`);
  });

  it("it throws an error if the database connection throws an error on instantiation", async () => {
    const errorMessage = "Test Error DB Connection";
    connectionMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(removeUnresolvedInvitations({} as Timer, new InvocationContext()))
      .rejects
      .toThrow(`removeUnresolvedInvitations: ${errorMessage}`);
  });

  it("it attempts to initialise all invitation related models with a connection to the directories DB", async () => {
    await removeUnresolvedInvitations({} as Timer, new InvocationContext());

    expect(initialiseAllInvitationModels).toHaveBeenCalled();
    expect(initialiseAllInvitationModels).toHaveBeenCalledWith(connection(DatabaseName.Directories));
  });

  it("it throws an error if the invitation retrieval query throws an error", async () => {
    const errorMessage = `Test Error Query`;
    invitationMock.findAll.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(removeUnresolvedInvitations({} as Timer, new InvocationContext()))
      .rejects
      .toThrow(`removeUnresolvedInvitations: ${errorMessage}`);
  });

  it("it performs the correct query to retrieve unresolved invitations on the Invitation model", async () => {
    const query = {
      attributes: ["id"],
      where: {
        [Op.and]: [
          {
            createdAt: {
              [Op.lt]: Sequelize.fn("DATEADD", Sequelize.literal("MONTH"), -3, Sequelize.fn("GETDATE"))
            }
          },
          { userId: null },
          { completed: false },
          { deactivated: false},
        ],
      },
    };
    await removeUnresolvedInvitations({} as Timer, new InvocationContext());

    expect(invitationMock.findAll).toHaveBeenCalled();
    expect(invitationMock.findAll).toHaveBeenCalledWith(query);
  });

  it("it logs the number of invitations found by the query", async () => {
    const invitationCount = 42;
    invitationMock.findAll.mockResolvedValue(generateInvitations(invitationCount));
    await removeUnresolvedInvitations({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      `removeUnresolvedInvitations: ${invitationCount} invitations found`
    );
  });

  describe("Invitation removal", () => {
    it("it logs the current range of invitations being removed in the current batch", async () => {
      invitationMock.findAll.mockResolvedValue(generateInvitations(300));
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalled();
      expect(contextMock.prototype.info).toHaveBeenCalledWith("removeUnresolvedInvitations: Removing invitations 1 to 100");
    });

    it("it attempts to retrieve the service records for each invitation", async () => {
      const invocationId = "TestId";
      const queryResult = generateInvitations(2);
      invitationMock.findAll.mockResolvedValue(queryResult);
      contextMock.prototype.invocationId = invocationId;
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(accessMock.prototype.getInvitationServices).toHaveBeenCalledTimes(2);
      expect(accessMock.prototype.getInvitationServices).toHaveBeenCalledWith(queryResult[0].id, invocationId);
      expect(accessMock.prototype.getInvitationServices).toHaveBeenCalledWith(queryResult[1].id, invocationId);
    });

    it("it attempts to retrieve the organisation records for each invitation", async () => {
      const invocationId = "TestId";
      const queryResult = generateInvitations(2);
      invitationMock.findAll.mockResolvedValue(queryResult);
      contextMock.prototype.invocationId = invocationId;
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(organisationsMock.prototype.getInvitationOrganisations).toHaveBeenCalledTimes(2);
      expect(organisationsMock.prototype.getInvitationOrganisations).toHaveBeenCalledWith(
        queryResult[0].id,
        invocationId
      );
      expect(organisationsMock.prototype.getInvitationOrganisations).toHaveBeenCalledWith(
        queryResult[1].id,
        invocationId
      );
    });

    it("it will not attempt to delete service or organisation records, if the service records request rejects", async () => {
      accessMock.prototype.getInvitationServices.mockRejectedValue(new Error("Test"));
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(accessMock.prototype.deleteInvitationService).not.toHaveBeenCalled();
      expect(organisationsMock.prototype.deleteInvitationOrganisation).not.toHaveBeenCalled();
    });

    it("it will not attempt to delete service or organisation records, if the organisation records request rejects", async () => {
      organisationsMock.prototype.getInvitationOrganisations.mockRejectedValue(new Error("Test"));
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(accessMock.prototype.deleteInvitationService).not.toHaveBeenCalled();
      expect(organisationsMock.prototype.deleteInvitationOrganisation).not.toHaveBeenCalled();
    });

    it("it will not attempt to delete service or organisation records, if the service & organisation records requests reject", async () => {
      accessMock.prototype.getInvitationServices.mockRejectedValue(new Error("Test"));
      organisationsMock.prototype.getInvitationOrganisations.mockRejectedValue(new Error("Test"));
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(accessMock.prototype.deleteInvitationService).not.toHaveBeenCalled();
      expect(organisationsMock.prototype.deleteInvitationOrganisation).not.toHaveBeenCalled();
    });

    it("it will not attempt to delete service records, if the service & organisation records requests resolve and there are no service records", async () => {
      accessMock.prototype.getInvitationServices.mockResolvedValue([]);
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(accessMock.prototype.deleteInvitationService).not.toHaveBeenCalled();
    });

    it("it will not attempt to delete organisation records, if the service & organisation records requests resolve and there are no organisation records", async () => {
      organisationsMock.prototype.getInvitationOrganisations.mockResolvedValue([]);
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(organisationsMock.prototype.deleteInvitationOrganisation).not.toHaveBeenCalled();
    });

    it("it will attempt to delete service records, if the service & organisation records requests resolve and there are service records", async () => {
      const invocationId = "TestId";
      const invitations = generateInvitations(1);
      const serviceRecords = generateInvitationServices(2, invitations[0].id);
      invitationMock.findAll.mockResolvedValue(invitations);
      accessMock.prototype.getInvitationServices.mockResolvedValue(serviceRecords);
      contextMock.prototype.invocationId = invocationId;
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(accessMock.prototype.deleteInvitationService).toHaveBeenCalledTimes(2);
      expect(accessMock.prototype.deleteInvitationService).toHaveBeenCalledWith(
        invitations[0].id,
        serviceRecords[0].serviceId,
        serviceRecords[0].organisationId,
        invocationId
      );
      expect(accessMock.prototype.deleteInvitationService).toHaveBeenCalledWith(
        invitations[0].id,
        serviceRecords[1].serviceId,
        serviceRecords[1].organisationId,
        invocationId
      );
    });

    it("it will attempt to delete organisation records, if the service & organisation records requests resolve and there are organisation records", async () => {
      const invocationId = "TestId";
      const invitations = generateInvitations(1);
      const orgRecords = generateInvitationOrganisations(2, invitations[0].id);
      invitationMock.findAll.mockResolvedValue(invitations);
      organisationsMock.prototype.getInvitationOrganisations.mockResolvedValue(orgRecords);
      contextMock.prototype.invocationId = invocationId;
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(organisationsMock.prototype.deleteInvitationOrganisation).toHaveBeenCalledTimes(2);
      expect(organisationsMock.prototype.deleteInvitationOrganisation).toHaveBeenCalledWith(
        invitations[0].id,
        orgRecords[0].organisation!.id,
        invocationId
      );
      expect(organisationsMock.prototype.deleteInvitationOrganisation).toHaveBeenCalledWith(
        invitations[0].id,
        orgRecords[1].organisation!.id,
        invocationId
      );
    });

    it("it logs the correct number of successful, failed, and errored invitations in a batch", async () => {
      invitationMock.findAll.mockResolvedValue(generateInvitations(6));
      accessMock.prototype.getInvitationServices
        .mockRejectedValueOnce(new Error(""))
        .mockResolvedValue(generateInvitationServices(1));
      accessMock.prototype.deleteInvitationService
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalled();
      expect(contextMock.prototype.info).toHaveBeenCalledWith(
        `removeUnresolvedInvitations: 3 successful, 2 failed, and 1 errored API record removals for invitations 1 to 6`
      );
    });

    it("it logs unique errors from any API calls if there are any for a batch (service & org retrieval)", async () => {
      const error1 = new Error("Test Error 1");
      const error2 = new Error("Test Error 2");
      const error3 = new Error("Test Error 3");
      invitationMock.findAll.mockResolvedValue(generateInvitations(5));
      accessMock.prototype.getInvitationServices
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockRejectedValueOnce(error3)
        .mockResolvedValue([]);
      organisationsMock.prototype.getInvitationOrganisations
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error3)
        .mockRejectedValueOnce(error2)
        .mockResolvedValue([]);
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(contextMock.prototype.error).toHaveBeenCalledTimes(3);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeUnresolvedInvitations: ${error1.message}`);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeUnresolvedInvitations: ${error2.message}`);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeUnresolvedInvitations: ${error3.message}`);
    });

    it("it logs unique errors from any API calls if there are any for a batch (service & org removal)", async () => {
      const error1 = new Error("Test Error 1");
      const error2 = new Error("Test Error 2");
      const error3 = new Error("Test Error 3");
      invitationMock.findAll.mockResolvedValue(generateInvitations(5));
      accessMock.prototype.getInvitationServices.mockResolvedValue(generateInvitationServices(1));
      organisationsMock.prototype.getInvitationOrganisations.mockResolvedValue(generateInvitationOrganisations(1));
      accessMock.prototype.deleteInvitationService
        .mockRejectedValueOnce(error3)
        .mockRejectedValueOnce(error2)
        .mockRejectedValueOnce(error1)
        .mockResolvedValue(true);
      organisationsMock.prototype.deleteInvitationOrganisation
        .mockRejectedValueOnce(error3)
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error3)
        .mockResolvedValue(true);
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(contextMock.prototype.error).toHaveBeenCalledTimes(3);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeUnresolvedInvitations: ${error1.message}`);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeUnresolvedInvitations: ${error2.message}`);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeUnresolvedInvitations: ${error3.message}`);
    });

    it("it throws an error if the entire batch errored", async () => {
      invitationMock.findAll.mockResolvedValue(generateInvitations(10));
      accessMock.prototype.getInvitationServices.mockRejectedValue(new Error(""));

      await expect(removeUnresolvedInvitations({} as Timer, new InvocationContext()))
        .rejects
        .toThrow("Entire batch had an error, failing execution so it can retry.");
    });

    it("it doesn't throw an error if not all invitations in the batch error", async () => {
      invitationMock.findAll.mockResolvedValue(generateInvitations(10));
      accessMock.prototype.getInvitationServices.mockRejectedValueOnce(new Error("")).mockResolvedValue([]);

      await expect(removeUnresolvedInvitations({} as Timer, new InvocationContext())).resolves.not.toThrow();
    });

    it("it doesn't log the number of successful invitations or delete DB records, if none of their API records are successfully removed", async () => {
      invitationMock.findAll.mockResolvedValue(generateInvitations(5));
      accessMock.prototype.getInvitationServices.mockResolvedValue(generateInvitationServices(1));
      accessMock.prototype.deleteInvitationService.mockResolvedValue(false);
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalled();
      expect(contextMock.prototype.info).not.toHaveBeenCalledWith(
        `removeUnresolvedInvitations: Removing database records for the 5 invitations with successful API record removals`
      );
      expect(invitationMock.destroy).not.toHaveBeenCalled();
    });

    it("it logs the number of invitations with successful API record deletions, if some are successful", async () => {
      invitationMock.findAll.mockResolvedValue(generateInvitations(5));
      accessMock.prototype.getInvitationServices
        .mockRejectedValueOnce(new Error(""))
        .mockResolvedValue(generateInvitationServices(1));
      accessMock.prototype.deleteInvitationService
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalled();
      expect(contextMock.prototype.info).toHaveBeenCalledWith(
        `removeUnresolvedInvitations: Removing database records for the 2 invitations with successful API record removals`
      );
    });

    it.each([
      ["InvitationCallback", invitationCallbackMock],
      ["Invitation", invitationMock],
    ])("it throws an error if any of the DB deletion queries throw an error (%p)", async (name, mock) => {
      const errorMessage = `Test Error Query ${name}`;
      const invitations = generateInvitations(100);
      invitationMock.findAll.mockResolvedValue(invitations);
      mock.destroy.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await expect(removeUnresolvedInvitations({} as Timer, new InvocationContext()))
        .rejects
        .toThrow(`removeUnresolvedInvitations: ${errorMessage}`);
    });

    it("it deletes all DB records for all invitations with successful API record deletions", async () => {
      const invitations = generateInvitations(100);
      invitationMock.findAll.mockResolvedValue(invitations);
      accessMock.prototype.getInvitationServices.mockResolvedValue(generateInvitationServices(1));
      organisationsMock.prototype.getInvitationOrganisations.mockResolvedValue(generateInvitationOrganisations(1));
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(invitationCallbackMock.destroy).toHaveBeenCalledWith({
        where: {
          invitationId: invitations.map((invitation) => invitation.id),
        },
      });
      expect(invitationMock.destroy).toHaveBeenCalledWith({
        where: {
          id: invitations.map((invitation) => invitation.id),
        },
      });
    });
  });
});
