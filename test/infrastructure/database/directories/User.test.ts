import { DataTypes, Model, Sequelize } from "sequelize";
import { initialiseUser } from "../../../../src/infrastructure/database/directories/User";

jest.mock("sequelize");

describe("User database model", () => {
  const model = jest.mocked(Model);

  describe("initialiseUser", () => {
    it("it initialises the user model with the expected attributes and passed sequelize connection", () => {
      const connection = new Sequelize();
      initialiseUser(connection);

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
          type: DataTypes.STRING(255),
          unique: true,
          allowNull: false,
        },
        firstName: {
          type: DataTypes.STRING(255),
          field: "given_name",
          allowNull: false,
        },
        lastName: {
          type: DataTypes.STRING(255),
          field: "family_name",
          allowNull: false,
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
          type: DataTypes.STRING(255),
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
          field: "is_entra",
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
