import { DataTypes, Model, Sequelize } from "sequelize";
import { initialiseUserModel } from "../../../../src/infrastructure/database/directories/User";

jest.mock("sequelize");

describe("User database model", () => {
  const model = jest.mocked(Model);

  describe("initialiseUserModel", () => {
    it("it initialises the user model with the expected attributes and passed sequelize connection", () => {
      const connection = new Sequelize();
      initialiseUserModel(connection);

      expect(model.init).toHaveBeenCalled();
      expect(model.init).toHaveBeenCalledWith({
        id: {
          type: DataTypes.UUIDV4,
          primaryKey: true,
          field: "sub",
          unique: true,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING,
          unique: true,
          allowNull: false
        },
        firstName: {
          type: DataTypes.STRING,
          field: "given_name",
          allowNull: false
        },
        lastName: {
          type: DataTypes.STRING,
          field: "family_name",
          allowNull: false
        },
        password: {
          type: DataTypes.STRING(5000),
          allowNull: false,
        },
        salt: {
          type: DataTypes.STRING(500),
          allowNull: false,
        },
        status: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        phoneNumber: {
          type: DataTypes.STRING(50),
          field: "phone_number",
        },
        lastLogin: {
          type: DataTypes.DATE,
          field: "last_login",
        },
        isMigrated: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
        jobTitle: {
          type: DataTypes.STRING,
          field: "job_title",
        },
        passwordResetRequired: {
          type: DataTypes.BOOLEAN,
          field: "password_reset_required",
          allowNull: false,
        },
        previousLogin: {
          type: DataTypes.DATE,
          field: "prev_login",
        },
        isEntra: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
        entraId: {
          type: DataTypes.UUID,
          field: "entra_oid",
          unique: true,
        },
        entraLinkedAt: {
          type: DataTypes.DATE,
          field: "entra_linked",
        },
      }, {
        tableName: "user",
        sequelize: connection,
      });
    });
  });
});
