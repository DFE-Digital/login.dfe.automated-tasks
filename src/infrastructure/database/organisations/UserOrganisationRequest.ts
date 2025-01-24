import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, Sequelize } from "sequelize";

/**
 * User Organisation Request schema model for CRUD operations the API doesn't currently support.
 */
export class UserOrganisationRequest extends Model<InferAttributes<UserOrganisationRequest>, InferCreationAttributes<UserOrganisationRequest>> {
  declare id: string;
  declare userId: string;
  declare organisationId: string;
  declare status: number;
  declare reason: string | null;
  declare actionedAt: Date | null;
  declare actionedBy: string | null;
  declare actionedReason: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
};

/**
 * Initialise the UserOrganisationRequest model with the data types and fields expected by the database.
 *
 * @param connection - A {@link Sequelize} object connected to a database.
 */
export function initialiseUserOrganisationRequest(connection: Sequelize): void {
  UserOrganisationRequest.init({
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
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  }, {
    tableName: "user_organisation_requests",
    sequelize: connection,
  });
};
