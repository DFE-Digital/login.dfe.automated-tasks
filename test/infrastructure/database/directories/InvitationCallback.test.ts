import { DataTypes, Model, Sequelize } from "sequelize";
import { initialiseInvitationCallback } from "../../../../src/infrastructure/database/directories/InvitationCallback";

jest.mock("sequelize");

describe("InvitationCallback database model", () => {
  const model = jest.mocked(Model);

  describe("initialiseInvitationCallback", () => {
    it("it initialises the invitation callback model with the expected attributes and passed sequelize connection", () => {
      const connection = new Sequelize();
      initialiseInvitationCallback(connection);

      expect(model.init).toHaveBeenCalled();
      expect(model.init).toHaveBeenCalledWith(
        {
          invitationId: {
            type: DataTypes.UUID,
            primaryKey: true,
            allowNull: false,
          },
          sourceId: {
            type: DataTypes.STRING(255),
            primaryKey: true,
            allowNull: false,
          },
          callbackUrl: {
            type: DataTypes.STRING(1024),
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
          clientId: {
            type: DataTypes.STRING(50),
          },
        },
        {
          tableName: "invitation_callback",
          sequelize: connection,
        },
      );
    });
  });
});
