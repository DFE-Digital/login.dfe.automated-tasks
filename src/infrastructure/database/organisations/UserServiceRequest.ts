import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, Sequelize } from "sequelize";

/**
 * User Service Request schema model for CRUD operations the API doesn't currently support.
 */
export class UserServiceRequest extends Model<InferAttributes<UserServiceRequest>, InferCreationAttributes<UserServiceRequest>> {
  declare id: string;
  declare userId: string;
  declare serviceId: string;
  declare roleIds: string | null;
  declare organisationId: string;
  declare status: number;
  declare reason: string | null;
  declare actionedAt: Date | null;
  declare actionedBy: string | null;
  declare actionedReason: string | null;
  declare requestType: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
};

/**
 * Initialise the UserServiceRequest model with the data types and fields expected by the database.
 *
 * @param connection - A {@link Sequelize} object connected to a database.
 */
export function initialiseUserServiceRequest(connection: Sequelize): void {
  UserServiceRequest.init({
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
};
