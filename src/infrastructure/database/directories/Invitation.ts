import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, Sequelize } from "sequelize";

/**
 * Invitation schema model for CRUD operations the API doesn't currently support.
 */
export class Invitation extends Model<InferAttributes<Invitation>, InferCreationAttributes<Invitation>> {
  declare id: string;
  declare email: string;
  declare code: string;
  declare firstName: string;
  declare lastName: string;
  declare originClientId: string | null;
  declare originRedirectUri: string | null;
  declare selfStarted: boolean;
  declare overrideSubject: string | null;
  declare overrideBody: string | null;
  declare previousUsername: string | null;
  declare previousPassword: string | null;
  declare previousSalt: string | null;
  declare deactivated: boolean;
  declare reason: string | null;
  declare completed: boolean;
  declare userId: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare isMigrated: boolean;
  declare isApprover: boolean;
  declare approverEmail: string | null;
  declare orgName: string | null;
  declare codeMetaData: string | null;
};

/**
 * Initialise the Invitation model with the data types and fields expected by the database.
 *
 * @param connection - A {@link Sequelize} object connected to a database.
 */
export function initialiseInvitation(connection: Sequelize): void {
  Invitation.init({
    id: {
      type: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(15),
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    originClientId: {
      type: DataTypes.STRING(50),
    },
    originRedirectUri: {
      type: DataTypes.STRING(1024),
    },
    selfStarted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    overrideSubject: {
      type: DataTypes.STRING(255),
    },
    overrideBody: {
      type: DataTypes.STRING("MAX"),
    },
    previousUsername: {
      type: DataTypes.STRING(50),
    },
    previousPassword: {
      type: DataTypes.STRING(255),
    },
    previousSalt: {
      type: DataTypes.STRING(255),
    },
    deactivated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING("MAX"),
    },
    completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUIDV4,
      field: "uid",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    isMigrated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    isApprover: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    approverEmail: {
      type: DataTypes.STRING(255),
    },
    orgName: {
      type: DataTypes.STRING(500),
    },
    codeMetaData: {
      type: DataTypes.STRING(255),
    },
  }, {
    tableName: "invitation",
    sequelize: connection,
  });
};
