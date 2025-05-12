import { DataTypes, Model, Sequelize } from "sequelize";
import { initialiseUserOrganisationRequest } from "../../../../src/infrastructure/database/organisations/UserOrganisationRequest";

jest.mock("sequelize");

describe("UserOrganisationRequest database model", () => {
  const model = jest.mocked(Model);

  describe("initialiseUserOrganisationRequest", () => {
    it("it initialises the user organisation request model with the expected attributes and passed sequelize connection", () => {
      const connection = new Sequelize();
      initialiseUserOrganisationRequest(connection);

      expect(model.init).toHaveBeenCalled();
      expect(model.init).toHaveBeenCalledWith(
        {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
          },
          userId: {
            type: DataTypes.UUID,
            field: "user_id",
            allowNull: false,
          },
          organisationId: {
            type: DataTypes.UUID,
            field: "organisation_id",
            allowNull: false,
          },
          status: {
            type: DataTypes.SMALLINT,
            allowNull: false,
          },
          reason: {
            type: DataTypes.STRING(5000),
          },
          actionedAt: {
            type: DataTypes.DATE,
            field: "actioned_at",
          },
          actionedBy: {
            type: DataTypes.UUID,
            field: "actioned_by",
          },
          actionedReason: {
            type: DataTypes.STRING(5000),
            field: "actioned_reason",
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
          tableName: "user_organisation_requests",
          sequelize: connection,
        },
      );
    });
  });
});
