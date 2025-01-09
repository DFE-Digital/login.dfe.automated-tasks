import { DataTypes, Model, Sequelize } from "sequelize";
import { initialiseUserBanner } from "../../../../src/infrastructure/database/organisations/UserBanner";

jest.mock("sequelize");

describe("UserBanner database model", () => {
  const model = jest.mocked(Model);

  describe("initialiseUserBanner", () => {
    it("it initialises the user banner model with the expected attributes and passed sequelize connection", () => {
      const connection = new Sequelize();
      initialiseUserBanner(connection);

      expect(model.init).toHaveBeenCalled();
      expect(model.init).toHaveBeenCalledWith({
        id: {
          type: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        userId: {
          type: DataTypes.UUIDV4,
          allowNull: false,
        },
        bannerId: {
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
        bannerData: {
          type: DataTypes.STRING(1000),
        },
      }, {
        tableName: "user_banners",
        sequelize: connection,
      });
    });
  });
});
