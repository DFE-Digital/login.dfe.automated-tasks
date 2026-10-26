import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  Sequelize,
  ForeignKey,
} from "sequelize";
import { User } from "./User";

/**
 * User Legacy Username schema model for CRUD operations the API doesn't currently support.
 */
export class UserLegacyUsername extends Model<
  InferAttributes<UserLegacyUsername>,
  InferCreationAttributes<UserLegacyUsername>
> {
  declare userId: ForeignKey<User["id"]>;
  declare legacyUsername: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

/**
 * Initialise the UserLegacyUsername model with the data types and fields expected by the database.
 *
 * @param connection - A {@link Sequelize} object connected to a database.
 */
export function initialiseUserLegacyUsername(connection: Sequelize): void {
  UserLegacyUsername.init(
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
}
