import { DataTypes, Model, Sequelize } from "sequelize";
import { initialiseUserPasswordHistory } from "../../../../src/infrastructure/database/directories/UserPasswordHistory";

jest.mock("sequelize");

describe("UserPasswordHistory database model", () => {
  const model = jest.mocked(Model);

  describe("initialiseUserPasswordHistory", () => {
    it("it initialises the user password history join model with the expected attributes and passed sequelize connection", () => {
      const connection = new Sequelize();
      initialiseUserPasswordHistory(connection);

      expect(model.init).toHaveBeenCalled();
      expect(model.init).toHaveBeenCalledWith(
        {
          passwordHistoryId: {
            type: DataTypes.UUID,
            field: "passwordHistoryId",
            primaryKey: true,
            allowNull: false,
          },
          userId: {
            type: DataTypes.UUID,
            field: "userSub",
            primaryKey: true,
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
          tableName: "user_password_history",
          sequelize: connection,
        },
      );
    });
  });
});
