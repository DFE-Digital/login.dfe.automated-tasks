import { Sequelize } from "sequelize";
import { initialiseAllUserModels } from "../../../../src/infrastructure/database/common/utils";
import { initialiseUser, User } from "../../../../src/infrastructure/database/directories/User";
import { initialiseUserPasswordPolicy, UserPasswordPolicy } from "../../../../src/infrastructure/database/directories/UserPasswordPolicy";
import { initialiseUserBanner } from "../../../../src/infrastructure/database/organisations/UserBanner";
import { initialiseUserOrganisationRequest } from "../../../../src/infrastructure/database/organisations/UserOrganisationRequest";
import { initialiseUserServiceRequest } from "../../../../src/infrastructure/database/organisations/UserServiceRequest";

jest.mock("sequelize");
jest.mock("../../../../src/infrastructure/database/directories/User");
jest.mock("../../../../src/infrastructure/database/directories/UserPasswordPolicy");
jest.mock("../../../../src/infrastructure/database/organisations/UserBanner");
jest.mock("../../../../src/infrastructure/database/organisations/UserOrganisationRequest");
jest.mock("../../../../src/infrastructure/database/organisations/UserServiceRequest");

describe("Cross-database utility functions", () => {
  describe("initialiseAllUserModels", () => {
    const directoriesDb = new Sequelize();
    const organisationsDb = new Sequelize();

    it("it initialises the User and linked models, using the correct database connections", () => {
      initialiseAllUserModels(directoriesDb, organisationsDb);

      expect(initialiseUser).toHaveBeenCalledWith(directoriesDb);
      expect(initialiseUserPasswordPolicy).toHaveBeenCalledWith(directoriesDb);
      expect(initialiseUserBanner).toHaveBeenCalledWith(organisationsDb);
      expect(initialiseUserOrganisationRequest).toHaveBeenCalledWith(organisationsDb);
      expect(initialiseUserServiceRequest).toHaveBeenCalledWith(organisationsDb);
    });

    it("it creates associations between models in the same database", () => {
      const userPasswordPolicyFk = {
        name: "userId",
        field: "uid",
      };
      initialiseAllUserModels(directoriesDb, organisationsDb);

      expect(User.hasMany).toHaveBeenCalled();
      expect(UserPasswordPolicy.belongsTo).toHaveBeenCalled();
      expect(User.hasMany).toHaveBeenCalledWith(UserPasswordPolicy, {
        foreignKey: userPasswordPolicyFk,
        as: "passwordPolicies",
      });
      expect(UserPasswordPolicy.belongsTo).toHaveBeenCalledWith(User, {
        foreignKey: userPasswordPolicyFk,
        as: "user",
      });
    });
  });
});
