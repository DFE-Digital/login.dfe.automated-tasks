import { DataTypes, Model, Sequelize } from "sequelize";
import { initialiseUserLegacyUsername } from "../../../../src/infrastructure/database/directories/UserLegacyUsername";

jest.mock("sequelize");

describe("UserLegacyUsername database model", () => {
  const model = jest.mocked(Model);

  describe("initialiseUserLegacyUsername", () => {
    it("it initialises the user legacy username model with the expected attributes and passed sequelize connection", () => {
      const connection = new Sequelize();
      initialiseUserLegacyUsername(connection);

      expect(model.init).toHaveBeenCalled();
      expect(model.init).toHaveBeenCalledWith(
        {
          userId: {
            type: DataTypes.UUID,
            field: "uid",
            primaryKey: true,
            allowNull: false,
          },
          legacyUsername: {
            type: DataTypes.STRING(255),
            field: "legacy_username",
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
          tableName: "user_legacy_username",
          sequelize: connection,
        },
      );
    });
  });
});
