import { DataTypes, Model, Sequelize } from "sequelize";
import { initialiseUserStatusChangeReason } from "../../../../src/infrastructure/database/directories/UserStatusChangeReason";

jest.mock("sequelize");

describe("UserStatusChangeReason database model", () => {
  const model = jest.mocked(Model);

  describe("initialiseUserStatusChangeReason", () => {
    it("it initialises the user status change reason model with the expected attributes and passed sequelize connection", () => {
      const connection = new Sequelize();
      initialiseUserStatusChangeReason(connection);

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
          userId: {
            type: DataTypes.UUID,
            field: "user_id",
            allowNull: false,
          },
          oldStatus: {
            type: DataTypes.SMALLINT,
            field: "old_status",
            allowNull: false,
          },
          newStatus: {
            type: DataTypes.SMALLINT,
            field: "new_status",
            allowNull: false,
          },
          reason: {
            type: DataTypes.STRING(5000),
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
          tableName: "user_status_change_reasons",
          sequelize: connection,
        },
      );
    });
  });
});
