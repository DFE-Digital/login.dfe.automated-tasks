import { DataTypes, Model, Sequelize } from "sequelize";
import { initialiseUserPasswordPolicy } from "../../../../src/infrastructure/database/directories/UserPasswordPolicy";

jest.mock("sequelize");

describe("UserPasswordPolicy database model", () => {
  const model = jest.mocked(Model);

  describe("initialiseUserPasswordPolicy", () => {
    it("it initialises the user password policy model with the expected attributes and passed sequelize connection", () => {
      const connection = new Sequelize();
      initialiseUserPasswordPolicy(connection);

      expect(model.init).toHaveBeenCalled();
      expect(model.init).toHaveBeenCalledWith({
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          unique: true,
          allowNull: false,
        },
        userId: {
          type: DataTypes.UUID,
          field: "uid",
          allowNull: false,
        },
        policyCode: {
          type: DataTypes.STRING(50),
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
        passwordHistoryLimit: {
          type: DataTypes.SMALLINT,
          field: "password_history_limit",
          allowNull: false,
        },
      }, {
        tableName: "user_password_policy",
        sequelize: connection,
      });
    });
  });
});
