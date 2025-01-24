import { InvocationContext, Timer } from "@azure/functions";
import { Op } from "sequelize";
import { removeGeneratedTestAccounts } from "../../src/functions/removeGeneratedTestAccounts";
import { Access, type invitationServiceRecord, type userServiceRecord } from "../../src/infrastructure/api/dsiInternal/Access";
import { Directories } from "../../src/infrastructure/api/dsiInternal/Directories";
import { Organisations, type invitationOrganisationRecord, type userOrganisationRecord } from "../../src/infrastructure/api/dsiInternal/Organisations";
import { connection, DatabaseName } from "../../src/infrastructure/database/common/connection";
import { initialiseAllUserModels } from "../../src/infrastructure/database/common/utils";
import { initialiseInvitation, Invitation } from "../../src/infrastructure/database/directories/Invitation";
import { User } from "../../src/infrastructure/database/directories/User";
import { UserPasswordPolicy } from "../../src/infrastructure/database/directories/UserPasswordPolicy";
import { UserBanner } from "../../src/infrastructure/database/organisations/UserBanner";
import { UserOrganisationRequest } from "../../src/infrastructure/database/organisations/UserOrganisationRequest";
import { UserServiceRequest } from "../../src/infrastructure/database/organisations/UserServiceRequest";

jest.mock("@azure/functions");
jest.mock("sequelize");
jest.mock("../../src/infrastructure/api/dsiInternal/Access");
jest.mock("../../src/infrastructure/api/dsiInternal/Directories");
jest.mock("../../src/infrastructure/api/dsiInternal/Organisations");
jest.mock("../../src/infrastructure/database/common/connection");
jest.mock("../../src/infrastructure/database/common/utils");
jest.mock("../../src/infrastructure/database/directories/Invitation");
jest.mock("../../src/infrastructure/database/directories/User");
jest.mock("../../src/infrastructure/database/directories/UserPasswordPolicy");
jest.mock("../../src/infrastructure/database/organisations/UserBanner");
jest.mock("../../src/infrastructure/database/organisations/UserOrganisationRequest");
jest.mock("../../src/infrastructure/database/organisations/UserServiceRequest");

describe("Remove generated test accounts automated task", () => {
  const contextMock = jest.mocked(InvocationContext);
  const accessMock = jest.mocked(Access);
  const directoriesMock = jest.mocked(Directories);
  const organisationsMock = jest.mocked(Organisations);
  const connectionMock = jest.mocked(connection);
  const invitationMock = jest.mocked(Invitation);
  const userMock = jest.mocked(User);
  const userPasswordPolicyMock = jest.mocked(UserPasswordPolicy);
  const userBannerMock = jest.mocked(UserBanner);
  const userOrgRequestMock = jest.mocked(UserOrganisationRequest);
  const userServiceRequestMock = jest.mocked(UserServiceRequest);
  const generateQueryResult: <T>(count: number) => T[] = (count: number) => Array(count).fill({
    id: "test",
  });
  const generateUserServiceResult: (id: number) => userServiceRecord = (id: number) => ({
    userId: "",
    serviceId: `svc-${id}`,
    organisationId: `org-${id}`,
    roles: [],
    identifiers: [],
    accessGrantedOn: "",
  });
  const generateUserOrganisationResult: (id: number) => userOrganisationRecord = (id: number) => ({
    organisation: {
      id: `org-${id}`,
      name: `org-${id}`,
      category: {
        id: "",
        name: "",
      },
      LegalName: null,
      urn: null,
      uid: null,
      upin: null,
      ukprn: null,
      establishmentNumber: null,
      closedOn: null,
      address: null,
      telephone: null,
      statutoryLowAge: null,
      statutoryHighAge: null,
      legacyId: null,
      companyRegistrationNumber: null,
      SourceSystem: null,
      providerTypeName: null,
      ProviderTypeCode: null,
      GIASProviderType: null,
      PIMSProviderType: null,
      PIMSProviderTypeCode: null,
      PIMSStatusName: null,
      pimsStatus: null,
      GIASStatusName: null,
      GIASStatus: null,
      MasterProviderStatusName: null,
      MasterProviderStatusCode: null,
      OpenedOn: null,
      DistrictAdministrativeName: null,
      DistrictAdministrativeCode: null,
      DistrictAdministrative_code: null,
      IsOnAPAR: null
    },
    role: {
      id: 0,
      name: "",
    },
    approvers: [],
    endUsers: [],
  });
  const generateInvitationServiceResult: (id: number) => invitationServiceRecord = (id: number) => ({
    invitationId: "",
    serviceId: `svc-${id}`,
    organisationId: `org-${id}`,
    roles: [],
    identifiers: [],
    accessGrantedOn: "",
  });
  const generateInvitationOrganisationResult: (id: number) => invitationOrganisationRecord = (id: number) => ({
    invitationId: "",
    organisation: {
      id: `org-${id}`,
      name: `org-${id}`,
    },
    role: {
      id: 0,
      name: "",
    },
    approvers: [],
    services: [],
  });

  beforeEach(() => {
    accessMock.prototype.getInvitationServices.mockResolvedValue([]);
    accessMock.prototype.getUserServices.mockResolvedValue([]);
    accessMock.prototype.deleteInvitationService.mockResolvedValue(true);
    accessMock.prototype.deleteUserService.mockResolvedValue(true);
    directoriesMock.prototype.deleteUserCode.mockResolvedValue(true);
    organisationsMock.prototype.getInvitationOrganisations.mockResolvedValue([]);
    organisationsMock.prototype.getUserOrganisations.mockResolvedValue([]);
    organisationsMock.prototype.deleteInvitationOrganisation.mockResolvedValue(true);
    organisationsMock.prototype.deleteUserOrganisation.mockResolvedValue(true);
    invitationMock.findAll.mockResolvedValue([]);
    userMock.findAll.mockResolvedValue([]);
  });

  it.each([
    ["Access", accessMock],
    ["Directories", directoriesMock],
    ["Organisations", organisationsMock],
  ])("it throws an error if any of the APIs throw an error on instantiation (%p)", async (name, mock) => {
    const errorMessage = `Test Error ${name}`;
    mock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    expect(removeGeneratedTestAccounts({} as Timer, new InvocationContext()))
      .rejects
      .toThrow(`removeGeneratedTestAccounts: ${errorMessage}`);
  });

  it("it throws an error if the database connection throws an error on instantiation", async () => {
    const errorMessage = "Test Error DB Connection";
    connectionMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    expect(removeGeneratedTestAccounts({} as Timer, new InvocationContext()))
      .rejects
      .toThrow(`removeGeneratedTestAccounts: ${errorMessage}`);
  });

  it("it attempts to initialise all user related models with a connection to the directories and organisations DBs", async () => {
    await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

    expect(initialiseAllUserModels).toHaveBeenCalled();
    expect(initialiseAllUserModels).toHaveBeenCalledWith(
      connection(DatabaseName.Directories),
      connection(DatabaseName.Organisations)
    );
  });

  it("it attempts to initialise the Invitation model with a connection to the directories DB", async () => {
    await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

    expect(initialiseInvitation).toHaveBeenCalled();
    expect(initialiseInvitation).toHaveBeenCalledWith(connection(DatabaseName.Directories));
  });

  it.each([
    ["User", userMock],
    ["Invitation", invitationMock],
  ])("it throws an error if the %p retrieval query throws an error", async (name, mock) => {
    const errorMessage = `Test Error Query ${name}`;
    mock.findAll.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    expect(removeGeneratedTestAccounts({} as Timer, new InvocationContext()))
      .rejects
      .toThrow(`removeGeneratedTestAccounts: ${errorMessage}`);
  });

  it("it performs the correct query to retrieve generated test accounts on the User and Invitation models", async () => {
    const query = {
      attributes: ["id"],
      where: {
        [Op.and]: [
          { email: { [Op.like]: "%mailosaur%" } },
          {
            [Op.or]: [
              { firstName: "CreateAccount", lastName: "Test" },
              { firstName: "Selenium_InviteUserTest", lastName: "Test" },
              { firstName: { [Op.like]: "InviteUserTest %" }, lastName: { [Op.like]: "AutomationTest %" }},
              { firstName: { [Op.like]: "SeleniumInviteUserTest%" }, lastName: { [Op.like]: "Test%" }},
            ],
          },
        ],
      },
    };
    await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

    expect(userMock.findAll).toHaveBeenCalled();
    expect(userMock.findAll).toHaveBeenCalledWith(query);
    expect(invitationMock.findAll).toHaveBeenCalled();
    expect(invitationMock.findAll).toHaveBeenCalledWith(query);
  });

  it("it logs the number of users and invitations found by the queries", async () => {
    const userCount = 25;
    const invitationCount = 42;
    userMock.findAll.mockResolvedValue(generateQueryResult<User>(userCount));
    invitationMock.findAll.mockResolvedValue(generateQueryResult<Invitation>(invitationCount));
    await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

    expect(contextMock.prototype.info).toHaveBeenCalled();
    expect(contextMock.prototype.info).toHaveBeenCalledWith(
      `removeGeneratedTestAccounts: ${userCount} users and ${invitationCount} invitations found`
    );
  });

  describe("User removal", () => {
    it("it logs the current range of users being removed in the current batch", async () => {
      userMock.findAll.mockResolvedValue(generateQueryResult<User>(300));
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalled();
      expect(contextMock.prototype.info).toHaveBeenCalledWith("removeGeneratedTestAccounts: Removing users 1 to 100");
    });

    it("it attempts to retrieve the service records for each user", async () => {
      const invocationId = "TestId";
      const generateQueryResult = [{
        id: "test1",
      }, {
        id: "test2",
      }];
      userMock.findAll.mockResolvedValue(generateQueryResult as User[]);
      contextMock.prototype.invocationId = invocationId;
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(accessMock.prototype.getUserServices).toHaveBeenCalledTimes(2);
      expect(accessMock.prototype.getUserServices).toHaveBeenCalledWith(generateQueryResult[0].id, invocationId);
      expect(accessMock.prototype.getUserServices).toHaveBeenCalledWith(generateQueryResult[1].id, invocationId);
    });

    it("it attempts to retrieve the organisation records for each user", async () => {
      const invocationId = "TestId";
      const generateQueryResult = [{
        id: "test1",
      }, {
        id: "test2",
      }];
      userMock.findAll.mockResolvedValue(generateQueryResult as User[]);
      contextMock.prototype.invocationId = invocationId;
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(organisationsMock.prototype.getUserOrganisations).toHaveBeenCalledTimes(2);
      expect(organisationsMock.prototype.getUserOrganisations).toHaveBeenCalledWith(
        generateQueryResult[0].id,
        invocationId
      );
      expect(organisationsMock.prototype.getUserOrganisations).toHaveBeenCalledWith(
        generateQueryResult[1].id,
        invocationId
      );
    });

    it("it attempts to delete any present code for each user", async () => {
      const invocationId = "TestId";
      const generateQueryResult = [{
        id: "test1",
      }, {
        id: "test2",
      }];
      userMock.findAll.mockResolvedValue(generateQueryResult as User[]);
      contextMock.prototype.invocationId = invocationId;
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(directoriesMock.prototype.deleteUserCode).toHaveBeenCalledTimes(2);
      expect(directoriesMock.prototype.deleteUserCode).toHaveBeenCalledWith(
        generateQueryResult[0].id,
        invocationId
      );
      expect(directoriesMock.prototype.deleteUserCode).toHaveBeenCalledWith(
        generateQueryResult[1].id,
        invocationId
      );
    });

    it("it will not attempt to delete service or organisation records, if the service records request rejects", async () => {
      accessMock.prototype.getUserServices.mockRejectedValue(new Error("Test"));
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(accessMock.prototype.deleteUserService).not.toHaveBeenCalled();
      expect(organisationsMock.prototype.deleteUserOrganisation).not.toHaveBeenCalled();
    });

    it("it will not attempt to delete service or organisation records, if the organisation records request rejects", async () => {
      organisationsMock.prototype.getUserOrganisations.mockRejectedValue(new Error("Test"));
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(accessMock.prototype.deleteUserService).not.toHaveBeenCalled();
      expect(organisationsMock.prototype.deleteUserOrganisation).not.toHaveBeenCalled();
    });

    it("it will not attempt to delete service or organisation records, if the service & organisation records requests reject", async () => {
      accessMock.prototype.getUserServices.mockRejectedValue(new Error("Test"));
      organisationsMock.prototype.getUserOrganisations.mockRejectedValue(new Error("Test"));
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(accessMock.prototype.deleteUserService).not.toHaveBeenCalled();
      expect(organisationsMock.prototype.deleteUserOrganisation).not.toHaveBeenCalled();
    });

    it("it will not attempt to delete service records, if the service & organisation records requests resolve and there are no service records", async () => {
      accessMock.prototype.getUserServices.mockResolvedValue([]);
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(accessMock.prototype.deleteUserService).not.toHaveBeenCalled();
    });

    it("it will not attempt to delete organisation records, if the service & organisation records requests resolve and there are no organisation records", async () => {
      organisationsMock.prototype.getUserOrganisations.mockResolvedValue([]);
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(organisationsMock.prototype.deleteUserOrganisation).not.toHaveBeenCalled();
    });

    it("it will attempt to delete service records, if the service & organisation records requests resolve and there are service records", async () => {
      const invocationId = "TestId";
      const users = generateQueryResult<User>(1);
      const serviceRecords = [
        generateUserServiceResult(1),
        generateUserServiceResult(1),
      ];
      userMock.findAll.mockResolvedValue(users);
      accessMock.prototype.getUserServices.mockResolvedValue(serviceRecords);
      contextMock.prototype.invocationId = invocationId;
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(accessMock.prototype.deleteUserService).toHaveBeenCalledTimes(2);
      expect(accessMock.prototype.deleteUserService).toHaveBeenCalledWith(
        users[0].id,
        serviceRecords[0].serviceId,
        serviceRecords[0].organisationId,
        invocationId
      );
      expect(accessMock.prototype.deleteUserService).toHaveBeenCalledWith(
        users[0].id,
        serviceRecords[1].serviceId,
        serviceRecords[1].organisationId,
        invocationId
      );
    });

    it("it will attempt to delete organisation records, if the service & organisation records requests resolve and there are organisation records", async () => {
      const invocationId = "TestId";
      const users = generateQueryResult<User>(1);
      const orgRecords = [
        generateUserOrganisationResult(1),
        generateUserOrganisationResult(2),
      ];
      userMock.findAll.mockResolvedValue(users);
      organisationsMock.prototype.getUserOrganisations.mockResolvedValue(orgRecords);
      contextMock.prototype.invocationId = invocationId;
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(organisationsMock.prototype.deleteUserOrganisation).toHaveBeenCalledTimes(2);
      expect(organisationsMock.prototype.deleteUserOrganisation).toHaveBeenCalledWith(
        users[0].id,
        orgRecords[0].organisation!.id,
        invocationId
      );
      expect(organisationsMock.prototype.deleteUserOrganisation).toHaveBeenCalledWith(
        users[0].id,
        orgRecords[1].organisation!.id,
        invocationId
      );
    });

    it("it logs the correct number of successful, failed, and errored users in a batch", async () => {
      userMock.findAll.mockResolvedValue(generateQueryResult<User>(7));
      accessMock.prototype.getUserServices
        .mockRejectedValueOnce(new Error(""))
        .mockResolvedValue([generateUserServiceResult(1)]);
      accessMock.prototype.deleteUserService
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
      directoriesMock.prototype.deleteUserCode
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalled();
      expect(contextMock.prototype.info).toHaveBeenCalledWith(
        `removeGeneratedTestAccounts: 3 successful, 3 failed, and 1 errored API record removals for users 1 to 7`
      );
    });

    it("it logs unique errors from any API calls if there are any for a batch (service & org retrieval)", async () => {
      const error1 = new Error("Test Error 1");
      const error2 = new Error("Test Error 2");
      const error3 = new Error("Test Error 3");
      userMock.findAll.mockResolvedValue(generateQueryResult<User>(5));
      accessMock.prototype.getUserServices
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockRejectedValueOnce(error3)
        .mockResolvedValue([]);
      organisationsMock.prototype.getUserOrganisations
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockRejectedValueOnce(error2)
        .mockResolvedValue([]);
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(contextMock.prototype.error).toHaveBeenCalledTimes(3);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeGeneratedTestAccounts: ${error1.message}`);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeGeneratedTestAccounts: ${error2.message}`);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeGeneratedTestAccounts: ${error3.message}`);
    });

    it("it includes deleteUserCode errors in the logged unique errors if there are any for a batch", async () => {
      const errorMessage = "Test Error deleteUserCode";
      userMock.findAll.mockResolvedValue(generateQueryResult<User>(5));
      directoriesMock.prototype.deleteUserCode
        .mockRejectedValueOnce(new Error(errorMessage))
        .mockRejectedValueOnce(new Error(errorMessage))
        .mockResolvedValue(true);
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(contextMock.prototype.error).toHaveBeenCalledTimes(1);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeGeneratedTestAccounts: ${errorMessage}`);
    });

    it("it logs unique errors from any API calls if there are any for a batch (code, service & org removal)", async () => {
      const error1 = new Error("Test Error 1");
      const error2 = new Error("Test Error 2");
      const error3 = new Error("Test Error 3");
      userMock.findAll.mockResolvedValue(generateQueryResult<User>(5));
      accessMock.prototype.getUserServices.mockResolvedValue([generateUserServiceResult(1)]);
      organisationsMock.prototype.getUserOrganisations.mockResolvedValue([generateUserOrganisationResult(1)]);
      directoriesMock.prototype.deleteUserCode.mockResolvedValue(true);
      accessMock.prototype.deleteUserService
        .mockRejectedValueOnce(error3)
        .mockRejectedValueOnce(error2)
        .mockRejectedValueOnce(error1)
        .mockResolvedValue(true);
      organisationsMock.prototype.deleteUserOrganisation
        .mockRejectedValueOnce(error3)
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error3)
        .mockResolvedValue(true);
      directoriesMock.prototype.deleteUserCode
        .mockRejectedValueOnce(error3)
        .mockRejectedValueOnce(error2)
        .mockRejectedValueOnce(error3)
        .mockResolvedValue(true);
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(contextMock.prototype.error).toHaveBeenCalledTimes(3);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeGeneratedTestAccounts: ${error1.message}`);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeGeneratedTestAccounts: ${error2.message}`);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeGeneratedTestAccounts: ${error3.message}`);
    });

    it("it throws an error if the entire batch errored", async () => {
      userMock.findAll.mockResolvedValue(generateQueryResult<User>(10));
      accessMock.prototype.getUserServices.mockRejectedValue(new Error(""));

      expect(removeGeneratedTestAccounts({} as Timer, new InvocationContext()))
        .rejects
        .toThrow("Entire batch had an error, failing execution so it can retry.");
    });

    it("it doesn't throw an error if not all users in the batch error", async () => {
      userMock.findAll.mockResolvedValue(generateQueryResult<User>(10));
      accessMock.prototype.getUserServices.mockRejectedValueOnce(new Error("")).mockResolvedValue([]);

      expect(removeGeneratedTestAccounts({} as Timer, new InvocationContext())).resolves.not.toThrow();
    });

    it("it doesn't log the number of successful users or delete DB records, if none of their API records are successfully removed", async () => {
      userMock.findAll.mockResolvedValue(generateQueryResult<User>(5));
      accessMock.prototype.getUserServices.mockResolvedValue([generateUserServiceResult(1)]);
      accessMock.prototype.deleteUserService.mockResolvedValue(false);
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalled();
      expect(contextMock.prototype.info).not.toHaveBeenCalledWith(
        `removeGeneratedTestAccounts: Removing database records for the 5 users with successful API record removals`
      );
      expect(userBannerMock.destroy).not.toHaveBeenCalled();
      expect(userOrgRequestMock.destroy).not.toHaveBeenCalled();
      expect(userServiceRequestMock.destroy).not.toHaveBeenCalled();
      expect(userPasswordPolicyMock.destroy).not.toHaveBeenCalled();
      expect(userMock.destroy).not.toHaveBeenCalled();
    });

    it("it logs the number of users with successful API record deletions, if some are successful", async () => {
      userMock.findAll.mockResolvedValue(generateQueryResult<User>(5));
      accessMock.prototype.getUserServices
        .mockRejectedValueOnce(new Error(""))
        .mockResolvedValue([generateUserServiceResult(1)]);
      accessMock.prototype.deleteUserService
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalled();
      expect(contextMock.prototype.info).toHaveBeenCalledWith(
        `removeGeneratedTestAccounts: Removing database records for the 2 users with successful API record removals`
      );
    });

    it.each([
      ["UserBanner", userBannerMock],
      ["UserOrganisationRequest", userOrgRequestMock],
      ["UserServiceRequest", userServiceRequestMock],
      ["UserPasswordPolicy", userPasswordPolicyMock],
      ["User", userMock],
    ])("it throws an error if any of the DB deletion queries throw an error (%p)", async (name, mock) => {
      const errorMessage = `Test Error Query ${name}`;
      const users = generateQueryResult<User>(100);
      userMock.findAll.mockResolvedValue(users);
      mock.destroy.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      expect(removeGeneratedTestAccounts({} as Timer, new InvocationContext()))
        .rejects
        .toThrow(`removeGeneratedTestAccounts: ${errorMessage}`);
    });

    it("it deletes all DB records for all users with successful API record deletions", async () => {
      const users = generateQueryResult<User>(100);
      const destroyQuery = {
        where: {
          userId: users.map((user) => user.id),
        },
      };
      userMock.findAll.mockResolvedValue(users);
      accessMock.prototype.getUserServices.mockResolvedValue([generateUserServiceResult(1)]);
      organisationsMock.prototype.getUserOrganisations.mockResolvedValue([generateUserOrganisationResult(1)]);
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(userBannerMock.destroy).toHaveBeenCalledWith(destroyQuery);
      expect(userOrgRequestMock.destroy).toHaveBeenCalledWith(destroyQuery);
      expect(userServiceRequestMock.destroy).toHaveBeenCalledWith(destroyQuery);
      expect(userPasswordPolicyMock.destroy).toHaveBeenCalledWith(destroyQuery);
      expect(userMock.destroy).toHaveBeenCalledWith({
        where: {
          id: users.map((user) => user.id),
        },
      });
    });
  });

  describe("Invitation removal", () => {
    it("it logs the current range of invitations being removed in the current batch", async () => {
      invitationMock.findAll.mockResolvedValue(generateQueryResult<Invitation>(300));
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalled();
      expect(contextMock.prototype.info).toHaveBeenCalledWith("removeGeneratedTestAccounts: Removing invitations 1 to 100");
    });

    it("it attempts to retrieve the service records for each invitation", async () => {
      const invocationId = "TestId";
      const queryResult = [{
        id: "test1",
      }, {
        id: "test2",
      }];
      invitationMock.findAll.mockResolvedValue(queryResult as Invitation[]);
      contextMock.prototype.invocationId = invocationId;
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(accessMock.prototype.getInvitationServices).toHaveBeenCalledTimes(2);
      expect(accessMock.prototype.getInvitationServices).toHaveBeenCalledWith(queryResult[0].id, invocationId);
      expect(accessMock.prototype.getInvitationServices).toHaveBeenCalledWith(queryResult[1].id, invocationId);
    });

    it("it attempts to retrieve the organisation records for each invitation", async () => {
      const invocationId = "TestId";
      const queryResult = [{
        id: "test1",
      }, {
        id: "test2",
      }];
      invitationMock.findAll.mockResolvedValue(queryResult as Invitation[]);
      contextMock.prototype.invocationId = invocationId;
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

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
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(accessMock.prototype.deleteInvitationService).not.toHaveBeenCalled();
      expect(organisationsMock.prototype.deleteInvitationOrganisation).not.toHaveBeenCalled();
    });

    it("it will not attempt to delete service or organisation records, if the organisation records request rejects", async () => {
      organisationsMock.prototype.getInvitationOrganisations.mockRejectedValue(new Error("Test"));
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(accessMock.prototype.deleteInvitationService).not.toHaveBeenCalled();
      expect(organisationsMock.prototype.deleteInvitationOrganisation).not.toHaveBeenCalled();
    });

    it("it will not attempt to delete service or organisation records, if the service & organisation records requests reject", async () => {
      accessMock.prototype.getInvitationServices.mockRejectedValue(new Error("Test"));
      organisationsMock.prototype.getInvitationOrganisations.mockRejectedValue(new Error("Test"));
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(accessMock.prototype.deleteInvitationService).not.toHaveBeenCalled();
      expect(organisationsMock.prototype.deleteInvitationOrganisation).not.toHaveBeenCalled();
    });

    it("it will not attempt to delete service records, if the service & organisation records requests resolve and there are no service records", async () => {
      accessMock.prototype.getInvitationServices.mockResolvedValue([]);
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(accessMock.prototype.deleteInvitationService).not.toHaveBeenCalled();
    });

    it("it will not attempt to delete organisation records, if the service & organisation records requests resolve and there are no organisation records", async () => {
      organisationsMock.prototype.getInvitationOrganisations.mockResolvedValue([]);
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(organisationsMock.prototype.deleteInvitationOrganisation).not.toHaveBeenCalled();
    });

    it("it will attempt to delete service records, if the service & organisation records requests resolve and there are service records", async () => {
      const invocationId = "TestId";
      const invitations = generateQueryResult<Invitation>(1);
      const serviceRecords = [
        generateInvitationServiceResult(1),
        generateInvitationServiceResult(1),
      ];
      invitationMock.findAll.mockResolvedValue(invitations);
      accessMock.prototype.getInvitationServices.mockResolvedValue(serviceRecords);
      contextMock.prototype.invocationId = invocationId;
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

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
      const invitations = generateQueryResult<Invitation>(1);
      const orgRecords = [
        generateInvitationOrganisationResult(1),
        generateInvitationOrganisationResult(2),
      ];
      invitationMock.findAll.mockResolvedValue(invitations);
      organisationsMock.prototype.getInvitationOrganisations.mockResolvedValue(orgRecords);
      contextMock.prototype.invocationId = invocationId;
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

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
      invitationMock.findAll.mockResolvedValue(generateQueryResult<Invitation>(6));
      accessMock.prototype.getInvitationServices
        .mockRejectedValueOnce(new Error(""))
        .mockResolvedValue([generateInvitationServiceResult(1)]);
      accessMock.prototype.deleteInvitationService
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalled();
      expect(contextMock.prototype.info).toHaveBeenCalledWith(
        `removeGeneratedTestAccounts: 3 successful, 2 failed, and 1 errored API record removals for invitations 1 to 6`
      );
    });

    it("it logs unique errors from any API calls if there are any for a batch (service & org retrieval)", async () => {
      const error1 = new Error("Test Error 1");
      const error2 = new Error("Test Error 2");
      const error3 = new Error("Test Error 3");
      invitationMock.findAll.mockResolvedValue(generateQueryResult<Invitation>(5));
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
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(contextMock.prototype.error).toHaveBeenCalledTimes(3);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeGeneratedTestAccounts: ${error1.message}`);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeGeneratedTestAccounts: ${error2.message}`);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeGeneratedTestAccounts: ${error3.message}`);
    });

    it("it logs unique errors from any API calls if there are any for a batch (service & org removal)", async () => {
      const error1 = new Error("Test Error 1");
      const error2 = new Error("Test Error 2");
      const error3 = new Error("Test Error 3");
      invitationMock.findAll.mockResolvedValue(generateQueryResult<Invitation>(5));
      accessMock.prototype.getInvitationServices.mockResolvedValue([generateInvitationServiceResult(1)]);
      organisationsMock.prototype.getInvitationOrganisations.mockResolvedValue([
        generateInvitationOrganisationResult(1),
      ]);
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
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(contextMock.prototype.error).toHaveBeenCalledTimes(3);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeGeneratedTestAccounts: ${error1.message}`);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeGeneratedTestAccounts: ${error2.message}`);
      expect(contextMock.prototype.error).toHaveBeenCalledWith(`removeGeneratedTestAccounts: ${error3.message}`);
    });

    it("it throws an error if the entire batch errored", async () => {
      invitationMock.findAll.mockResolvedValue(generateQueryResult<Invitation>(10));
      accessMock.prototype.getInvitationServices.mockRejectedValue(new Error(""));

      expect(removeGeneratedTestAccounts({} as Timer, new InvocationContext()))
        .rejects
        .toThrow("Entire batch had an error, failing execution so it can retry.");
    });

    it("it doesn't throw an error if not all invitations in the batch error", async () => {
      invitationMock.findAll.mockResolvedValue(generateQueryResult<Invitation>(10));
      accessMock.prototype.getInvitationServices.mockRejectedValueOnce(new Error("")).mockResolvedValue([]);

      expect(removeGeneratedTestAccounts({} as Timer, new InvocationContext())).resolves.not.toThrow();
    });

    it("it doesn't log the number of successful invitations or delete DB records, if none of their API records are successfully removed", async () => {
      invitationMock.findAll.mockResolvedValue(generateQueryResult<Invitation>(5));
      accessMock.prototype.getInvitationServices.mockResolvedValue([generateInvitationServiceResult(1)]);
      accessMock.prototype.deleteInvitationService.mockResolvedValue(false);
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalled();
      expect(contextMock.prototype.info).not.toHaveBeenCalledWith(
        `removeGeneratedTestAccounts: Removing database records for the 5 invitations with successful API record removals`
      );
      expect(invitationMock.destroy).not.toHaveBeenCalled();
    });

    it("it logs the number of invitations with successful API record deletions, if some are successful", async () => {
      invitationMock.findAll.mockResolvedValue(generateQueryResult<Invitation>(5));
      accessMock.prototype.getInvitationServices
        .mockRejectedValueOnce(new Error(""))
        .mockResolvedValue([generateInvitationServiceResult(1)]);
      accessMock.prototype.deleteInvitationService
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(contextMock.prototype.info).toHaveBeenCalled();
      expect(contextMock.prototype.info).toHaveBeenCalledWith(
        `removeGeneratedTestAccounts: Removing database records for the 2 invitations with successful API record removals`
      );
    });

    it("it throws an error if the invitation DB deletion query throws an error", async () => {
      const errorMessage = `Test Error Query Invitation`;
      const invitations = generateQueryResult<Invitation>(100);
      invitationMock.findAll.mockResolvedValue(invitations);
      invitationMock.destroy.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      expect(removeGeneratedTestAccounts({} as Timer, new InvocationContext()))
        .rejects
        .toThrow(`removeGeneratedTestAccounts: ${errorMessage}`);
    });

    it("it deletes all DB records for all invitations with successful API record deletions", async () => {
      const invitations = generateQueryResult<Invitation>(100);
      invitationMock.findAll.mockResolvedValue(invitations);
      accessMock.prototype.getInvitationServices.mockResolvedValue([generateInvitationServiceResult(1)]);
      organisationsMock.prototype.getInvitationOrganisations.mockResolvedValue([
        generateInvitationOrganisationResult(1)
      ]);
      await removeGeneratedTestAccounts({} as Timer, new InvocationContext());

      expect(invitationMock.destroy).toHaveBeenCalledWith({
        where: {
          id: invitations.map((invitation) => invitation.id),
        },
      });
    });
  });
});
