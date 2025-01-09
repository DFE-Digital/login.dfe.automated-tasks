import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, Sequelize, ForeignKey, NonAttribute } from "sequelize";
import { User } from "./User";

/**
 * User Password Policy schema model for CRUD operations the API doesn't currently support.
 */
export class UserPasswordPolicy extends Model<InferAttributes<UserPasswordPolicy>, InferCreationAttributes<UserPasswordPolicy>> {
  declare id: string;
  declare userId: ForeignKey<User["id"]>;
  declare policyCode: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare passwordHistoryLimit: Number;
  declare user?: NonAttribute<User>;
};

/**
 * Initialise the UserPasswordPolicy model with the data types and fields expected by the database.
 *
 * @param connection - A {@link Sequelize} object connected to a database.
 */
export function initialiseUserPasswordPolicy(connection: Sequelize): void {
  UserPasswordPolicy.init({
    id: {
      type: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
      allowNull: false,
    },
    policyCode: {
      type: DataTypes.STRING(50),
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
    passwordHistoryLimit: {
      type: DataTypes.SMALLINT,
      field: "password_history_limit",
      allowNull: false,
    },
  }, {
    tableName: "user_password_policy",
    sequelize: connection,
  });
};
