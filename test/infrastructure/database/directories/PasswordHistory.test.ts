import { DataTypes, Model, Sequelize } from "sequelize";
import { initialisePasswordHistory } from "../../../../src/infrastructure/database/directories/PasswordHistory";

jest.mock("sequelize");

describe("PasswordHistory database model", () => {
  const model = jest.mocked(Model);

  describe("initialisePasswordHistory", () => {
    it("it initialises the password history model with the expected attributes and passed sequelize connection", () => {
      const connection = new Sequelize();
      initialisePasswordHistory(connection);

      expect(model.init).toHaveBeenCalled();
      expect(model.init).toHaveBeenCalledWith(
        {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            unique: true,
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
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
          },
        },
        {
          tableName: "password_history",
          sequelize: connection,
        },
      );
    });
  });
});
