import { DataTypes, Sequelize } from "sequelize";
import {
  initialiseAccountDeletionModels,
  initialiseAllInvitationModels,
  initialiseAllUserModels,
} from "../../../../src/infrastructure/database/common/utils";
import {
  initialiseUser,
  User,
} from "../../../../src/infrastructure/database/directories/User";
import {
  initialiseUserPasswordPolicy,
  UserPasswordPolicy,
} from "../../../../src/infrastructure/database/directories/UserPasswordPolicy";
import {
  initialiseInvitation,
  Invitation,
} from "../../../../src/infrastructure/database/directories/Invitation";
import {
  initialiseInvitationCallback,
  InvitationCallback,
} from "../../../../src/infrastructure/database/directories/InvitationCallback";
import { initialiseUserBanner } from "../../../../src/infrastructure/database/organisations/UserBanner";
import { initialiseUserOrganisationRequest } from "../../../../src/infrastructure/database/organisations/UserOrganisationRequest";
import { initialiseUserServiceRequest } from "../../../../src/infrastructure/database/organisations/UserServiceRequest";
import { initialiseUserStatusChangeReason } from "../../../../src/infrastructure/database/directories/UserStatusChangeReason";
import { initialiseUserLegacyUsername } from "../../../../src/infrastructure/database/directories/UserLegacyUsername";
import { initialisePasswordHistory } from "../../../../src/infrastructure/database/directories/PasswordHistory";
import { initialiseUserPasswordHistory } from "../../../../src/infrastructure/database/directories/UserPasswordHistory";

jest.mock("sequelize");
jest.mock("../../../../src/infrastructure/database/directories/User");
jest.mock(
  "../../../../src/infrastructure/database/directories/UserPasswordPolicy",
);
jest.mock("../../../../src/infrastructure/database/directories/Invitation");
jest.mock(
  "../../../../src/infrastructure/database/directories/InvitationCallback",
);
jest.mock("../../../../src/infrastructure/database/organisations/UserBanner");
jest.mock(
  "../../../../src/infrastructure/database/organisations/UserOrganisationRequest",
);
jest.mock(
  "../../../../src/infrastructure/database/organisations/UserServiceRequest",
);
jest.mock(
  "../../../../src/infrastructure/database/directories/UserStatusChangeReason",
);
jest.mock(
  "../../../../src/infrastructure/database/directories/UserLegacyUsername",
);
jest.mock(
  "../../../../src/infrastructure/database/directories/PasswordHistory",
);
jest.mock(
  "../../../../src/infrastructure/database/directories/UserPasswordHistory",
);

describe("Cross-database utility functions", () => {
  describe("initialiseAllUserModels", () => {
    const directoriesDb = new Sequelize();
    const organisationsDb = new Sequelize();

    it("it initialises the User and linked models, using the correct database connections", () => {
      initialiseAllUserModels(directoriesDb, organisationsDb);

      expect(initialiseUser).toHaveBeenCalledWith(directoriesDb);
      expect(initialiseUserPasswordPolicy).toHaveBeenCalledWith(directoriesDb);
      expect(initialiseUserBanner).toHaveBeenCalledWith(organisationsDb);
      expect(initialiseUserOrganisationRequest).toHaveBeenCalledWith(
        organisationsDb,
      );
      expect(initialiseUserServiceRequest).toHaveBeenCalledWith(
        organisationsDb,
      );
    });

    it("it creates associations between models in the same database", () => {
      initialiseAllUserModels(directoriesDb, organisationsDb);

      expect(User.hasMany).toHaveBeenCalled();
      expect(UserPasswordPolicy.belongsTo).toHaveBeenCalled();
      expect(User.hasMany).toHaveBeenCalledWith(UserPasswordPolicy, {
        foreignKey: {
          name: "userId",
          field: "uid",
          allowNull: false,
        },
        keyType: DataTypes.UUID,
        as: "passwordPolicies",
      });
      expect(UserPasswordPolicy.belongsTo).toHaveBeenCalledWith(User, {
        as: "user",
      });
    });
  });

  describe("initialiseAllInvitationModels", () => {
    const directoriesDb = new Sequelize();

    it("it initialises the Invitation and linked models using the correct database connection", () => {
      initialiseAllInvitationModels(directoriesDb);

      expect(initialiseInvitation).toHaveBeenCalledWith(directoriesDb);
      expect(initialiseInvitationCallback).toHaveBeenCalledWith(directoriesDb);
    });

    it("it creates associations between models in the same database", () => {
      initialiseAllInvitationModels(directoriesDb);

      expect(Invitation.hasMany).toHaveBeenCalled();
      expect(InvitationCallback.belongsTo).toHaveBeenCalled();
      expect(Invitation.hasMany).toHaveBeenCalledWith(InvitationCallback, {
        foreignKey: {
          name: "invitationId",
          allowNull: false,
        },
        keyType: DataTypes.UUID,
        as: "callbacks",
      });
      expect(InvitationCallback.belongsTo).toHaveBeenCalledWith(Invitation, {
        as: "invitation",
      });
    });
  });

  describe("initialiseAccountDeletionModels", () => {
    const directoriesDb = new Sequelize();

    it("it initialises the User model and every model needed to permanently delete an account, using the directories database connection", () => {
      initialiseAccountDeletionModels(directoriesDb);

      expect(initialiseUser).toHaveBeenCalledWith(directoriesDb);
      expect(initialiseUserPasswordPolicy).toHaveBeenCalledWith(directoriesDb);
      expect(initialiseUserStatusChangeReason).toHaveBeenCalledWith(
        directoriesDb,
      );
      expect(initialiseUserLegacyUsername).toHaveBeenCalledWith(directoriesDb);
      expect(initialisePasswordHistory).toHaveBeenCalledWith(directoriesDb);
      expect(initialiseUserPasswordHistory).toHaveBeenCalledWith(directoriesDb);
      expect(initialiseInvitation).toHaveBeenCalledWith(directoriesDb);
    });
  });
});
