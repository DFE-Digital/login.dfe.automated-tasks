import { DataTypes, Model, Sequelize } from "sequelize";
import { initialiseInvitation } from "../../../../src/infrastructure/database/directories/Invitation";

jest.mock("sequelize");

describe("Invitation database model", () => {
  const model = jest.mocked(Model);

  describe("initialiseInvitation", () => {
    it("it initialises the invitation model with the expected attributes and passed sequelize connection", () => {
      const connection = new Sequelize();
      initialiseInvitation(connection);

      expect(model.init).toHaveBeenCalled();
      expect(model.init).toHaveBeenCalledWith({
        id: {
          type: DataTypes.UUIDV4,
          primaryKey: true,
          unique: true,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        code: {
          type: DataTypes.STRING(15),
          allowNull: false,
        },
        firstName: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        lastName: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        originClientId: {
          type: DataTypes.STRING(50),
        },
        originRedirectUri: {
          type: DataTypes.STRING(1024),
        },
        selfStarted: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
        overrideSubject: {
          type: DataTypes.STRING(255),
        },
        overrideBody: {
          type: DataTypes.STRING("MAX"),
        },
        previousUsername: {
          type: DataTypes.STRING(50),
        },
        previousPassword: {
          type: DataTypes.STRING(255),
        },
        previousSalt: {
          type: DataTypes.STRING(255),
        },
        deactivated: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
        reason: {
          type: DataTypes.STRING("MAX"),
        },
        completed: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
        userId: {
          type: DataTypes.UUIDV4,
          field: "uid",
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        isMigrated: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
        isApprover: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
        approverEmail: {
          type: DataTypes.STRING(255),
        },
        orgName: {
          type: DataTypes.STRING(500),
        },
        codeMetaData: {
          type: DataTypes.STRING(255),
        },
      }, {
        tableName: "invitation",
        sequelize: connection,
      });
    });
  });
});
