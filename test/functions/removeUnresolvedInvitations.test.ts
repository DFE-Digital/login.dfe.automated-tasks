import { InvocationContext, Timer } from "@azure/functions";
import { Op, Sequelize } from "sequelize";
import { generateInvitationOrganisations, generateInvitations, generateInvitationServices } from "../testUtils";
import { removeUnresolvedInvitations } from "../../src/functions/removeUnresolvedInvitations";
import { deleteInvitationApiRecords, deleteInvitationDbRecords, getInvitationApiRecords } from "../../src/functions/services/invitations";
import { Access } from "../../src/infrastructure/api/dsiInternal/Access";
import { Organisations } from "../../src/infrastructure/api/dsiInternal/Organisations";
import { connection, DatabaseName } from "../../src/infrastructure/database/common/connection";
import { initialiseAllInvitationModels } from "../../src/infrastructure/database/common/utils";
import { Invitation } from "../../src/infrastructure/database/directories/Invitation";

jest.mock("@azure/functions");
jest.mock("../../src/functions/services/invitations");
jest.mock("../../src/infrastructure/api/dsiInternal/Access");
jest.mock("../../src/infrastructure/api/dsiInternal/Organisations");
jest.mock("../../src/infrastructure/database/common/connection");
jest.mock("../../src/infrastructure/database/common/utils");
jest.mock("../../src/infrastructure/database/directories/Invitation");

describe("Remove unresolved invitations automated task", () => {
  const contextMock = jest.mocked(InvocationContext);
  const connectionMock = jest.mocked(connection);
  const invitationMock = jest.mocked(Invitation);
  const getInvitationApiRecordsMock = jest.mocked(getInvitationApiRecords);
  const deleteInvitationApiRecordsMock = jest.mocked(deleteInvitationApiRecords);
  const deleteInvitationDbRecordsMock = jest.mocked(deleteInvitationDbRecords);

  beforeEach(() => {
    invitationMock.findAll.mockResolvedValue([]);
    getInvitationApiRecordsMock.mockResolvedValue({
      services: [],
      organisations: [],
    });
    deleteInvitationApiRecordsMock.mockImplementation((
      _apis,
      invitationId
    ) => Promise.resolve({
      object: invitationId,
      success: true,
    }));
  });

  it.each([
    ["Access", jest.mocked(Access)],
    ["Organisations", jest.mocked(Organisations)],
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
    const apiClients = expect.objectContaining({
      access: expect.any(Access),
      organisations: expect.any(Organisations),
    });

    it("it logs the current range of invitations being removed in the current batch", async () => {
      invitationMock.findAll.mockResolvedValue(generateInvitations(300));
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalled();
      expect(contextMock.prototype.info).toHaveBeenCalledWith("removeUnresolvedInvitations: Removing invitations 1 to 100");
    });

    it("it attempts to retrieve the service/organisation records for each invitation", async () => {
      const invocationId = "TestId";
      const queryResult = generateInvitations(2);
      invitationMock.findAll.mockResolvedValue(queryResult);
      contextMock.prototype.invocationId = invocationId;
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(getInvitationApiRecords).toHaveBeenCalledTimes(2);
      expect(getInvitationApiRecords).toHaveBeenCalledWith(apiClients, queryResult[0].id, invocationId);
      expect(getInvitationApiRecords).toHaveBeenCalledWith(apiClients, queryResult[1].id, invocationId);
    });

    it("it will not attempt to delete service/organisation records, if the retrieval rejects", async () => {
      getInvitationApiRecordsMock.mockRejectedValue([new Error("Test")]);
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(deleteInvitationApiRecords).not.toHaveBeenCalled();
    });

    it("it attempts to delete service/organisation records with any records found, if the retrieval resolves", async () => {
      const invocationId = "TestId";
      const invitations = generateInvitations(2);
      const records1 = {
        services: [],
        organisations: generateInvitationOrganisations(2, invitations[0].id),
      };
      const records2 = {
        services: generateInvitationServices(2, invitations[1].id),
        organisations: [],
      };
      invitationMock.findAll.mockResolvedValue(invitations);
      getInvitationApiRecordsMock.mockResolvedValueOnce(records1).mockResolvedValueOnce(records2);
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(deleteInvitationApiRecords).toHaveBeenCalledTimes(2);
      expect(deleteInvitationApiRecords).toHaveBeenCalledWith(apiClients, invitations[0].id, records1, invocationId);
      expect(deleteInvitationApiRecords).toHaveBeenCalledWith(apiClients, invitations[1].id, records2, invocationId);
    });

    it("it logs the correct number of successful, failed, and errored invitation service/organisation retrievals/removals in a batch", async () => {
      invitationMock.findAll.mockResolvedValue(generateInvitations(6));
      getInvitationApiRecordsMock
        .mockRejectedValueOnce([new Error()])
        .mockResolvedValue({
          services: [],
          organisations: [],
        });
      deleteInvitationApiRecordsMock
        .mockResolvedValueOnce({
          object: "",
          success: false,
        })
        .mockResolvedValueOnce({
          object: "",
          success: false,
        })
        .mockResolvedValue({
          object: "",
          success: true,
        });
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
      getInvitationApiRecordsMock
        .mockRejectedValueOnce([error1, error1])
        .mockRejectedValueOnce([error2, error3])
        .mockRejectedValueOnce([error3, error2])
        .mockResolvedValue({
          services: [],
          organisations: [],
        });
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
      deleteInvitationApiRecordsMock
        .mockRejectedValueOnce([error1, error1])
        .mockRejectedValueOnce([error2, error3])
        .mockRejectedValueOnce([error3, error2])
        .mockResolvedValue({
          object: "",
          success: true,
        });
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(contextMock.prototype.error).toHaveBeenCalledTimes(3);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeUnresolvedInvitations: ${error1.message}`);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeUnresolvedInvitations: ${error2.message}`);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeUnresolvedInvitations: ${error3.message}`);
    });

    it("it throws an error if the entire batch errored", async () => {
      invitationMock.findAll.mockResolvedValue(generateInvitations(10));
      getInvitationApiRecordsMock.mockRejectedValue([new Error("")]);

      await expect(removeUnresolvedInvitations({} as Timer, new InvocationContext()))
        .rejects
        .toThrow("Entire batch had an error, failing execution so it can retry.");
    });

    it("it doesn't throw an error if not all invitations in the batch error", async () => {
      invitationMock.findAll.mockResolvedValue(generateInvitations(10));
      getInvitationApiRecordsMock.mockRejectedValueOnce([new Error("")]).mockResolvedValue({
        services: [],
        organisations: [],
      });

      await expect(removeUnresolvedInvitations({} as Timer, new InvocationContext())).resolves.not.toThrow();
    });

    it("it doesn't log the number of successful invitations or delete DB records, if none of their API records are successfully removed", async () => {
      invitationMock.findAll.mockResolvedValue(generateInvitations(5));
      deleteInvitationApiRecordsMock.mockResolvedValue({
        object: "",
        success: false,
      });
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalled();
      expect(contextMock.prototype.info).not.toHaveBeenCalledWith(
        `removeUnresolvedInvitations: Removing database records for the 5 invitations with successful API record removals`
      );
      expect(deleteInvitationDbRecords).not.toHaveBeenCalled();
    });

    it("it logs the number of invitations with successful API record deletions, if some are successful", async () => {
      invitationMock.findAll.mockResolvedValue(generateInvitations(5));
      getInvitationApiRecordsMock
        .mockRejectedValueOnce([new Error("")])
        .mockResolvedValue({
          services: generateInvitationServices(1),
          organisations: [],
        });
      deleteInvitationApiRecordsMock
        .mockResolvedValueOnce({
          object: "",
          success: false,
        })
        .mockResolvedValueOnce({
          object: "",
          success: false,
        })
        .mockResolvedValue({
          object: "",
          success: true,
        });
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalled();
      expect(contextMock.prototype.info).toHaveBeenCalledWith(
        `removeUnresolvedInvitations: Removing database records for the 2 invitations with successful API record removals`
      );
    });

    it("it throws an error if the invitation DB deletion rejects", async () => {
      const errorMessage = "Test Error Query";
      const invitations = generateInvitations(100);
      invitationMock.findAll.mockResolvedValue(invitations);
      deleteInvitationDbRecordsMock.mockRejectedValue(new Error(errorMessage));

      await expect(removeUnresolvedInvitations({} as Timer, new InvocationContext()))
        .rejects
        .toThrow(`removeUnresolvedInvitations: ${errorMessage}`);
    });

    it("it deletes all DB records for all invitations with successful API record deletions", async () => {
      const invitations = generateInvitations(100);
      invitationMock.findAll.mockResolvedValue(invitations);
      await removeUnresolvedInvitations({} as Timer, new InvocationContext());

      expect(deleteInvitationDbRecordsMock).toHaveBeenCalled();
      expect(deleteInvitationDbRecordsMock).toHaveBeenCalledWith(invitations.map((invitation) => invitation.id));
    });
  });
});
