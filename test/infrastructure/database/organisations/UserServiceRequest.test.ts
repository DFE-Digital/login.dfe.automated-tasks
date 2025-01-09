import { DataTypes, Model, Sequelize } from "sequelize";
import { initialiseUserServiceRequest } from "../../../../src/infrastructure/database/organisations/UserServiceRequest";

jest.mock("sequelize");

describe("UserServiceRequest database model", () => {
  const model = jest.mocked(Model);

  describe("initialiseUserServiceRequest", () => {
    it("it initialises the user service request model with the expected attributes and passed sequelize connection", () => {
      const connection = new Sequelize();
      initialiseUserServiceRequest(connection);

      expect(model.init).toHaveBeenCalled();
      expect(model.init).toHaveBeenCalledWith({
        id: {
          type: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        userId: {
          type: DataTypes.UUIDV4,
          field: "user_id",
          allowNull: false,
        },
        serviceId: {
          type: DataTypes.UUIDV4,
          field: "service_id",
          allowNull: false,
        },
        roleIds: {
          type: DataTypes.STRING(5000),
          field: "role_ids",
        },
        organisationId: {
          type: DataTypes.UUIDV4,
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
          type: DataTypes.UUIDV4,
          field: "actioned_by",
        },
        actionedReason: {
          type: DataTypes.STRING(5000),
          field: "actioned_reason",
        },
        requestType: {
          type: DataTypes.STRING(10),
          field: "request_type",
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      }, {
        tableName: "user_service_requests",
        sequelize: connection,
      });
    });
  });
});
