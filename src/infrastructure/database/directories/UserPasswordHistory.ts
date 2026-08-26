import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  Sequelize,
  ForeignKey,
  CreationOptional,
} from "sequelize";
import { User } from "./User";
import { PasswordHistory } from "./PasswordHistory";

/**
 * User Password History schema model for CRUD operations the API doesn't currently support.
 *
 * Join table linking a user to their {@link PasswordHistory} entries.
 */
export class UserPasswordHistory extends Model<
  InferAttributes<UserPasswordHistory>,
  InferCreationAttributes<UserPasswordHistory>
> {
  declare passwordHistoryId: ForeignKey<PasswordHistory["id"]>;
  declare userId: ForeignKey<User["id"]>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

/**
 * Initialise the UserPasswordHistory model with the data types and fields expected by the database.
 *
 * @param connection - A {@link Sequelize} object connected to a database.
 */
export function initialiseUserPasswordHistory(connection: Sequelize): void {
  UserPasswordHistory.init(
    {
      passwordHistoryId: {
        type: DataTypes.UUID,
        field: "passwordHistoryId",
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        field: "userSub",
        primaryKey: true,
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
      tableName: "user_password_history",
      sequelize: connection,
    },
  );
}
