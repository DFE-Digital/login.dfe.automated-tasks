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
 * User Status Change Reason schema model for CRUD operations the API doesn't currently support.
 */
export class UserStatusChangeReason extends Model<
  InferAttributes<UserStatusChangeReason>,
  InferCreationAttributes<UserStatusChangeReason>
> {
  declare id: string;
  declare userId: ForeignKey<User["id"]>;
  declare oldStatus: number;
  declare newStatus: number;
  declare reason: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

/**
 * Initialise the UserStatusChangeReason model with the data types and fields expected by the database.
 *
 * @param connection - A {@link Sequelize} object connected to a database.
 */
export function initialiseUserStatusChangeReason(connection: Sequelize): void {
  UserStatusChangeReason.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        unique: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        field: "user_id",
        allowNull: false,
      },
      oldStatus: {
        type: DataTypes.SMALLINT,
        field: "old_status",
        allowNull: false,
      },
      newStatus: {
        type: DataTypes.SMALLINT,
        field: "new_status",
        allowNull: false,
      },
      reason: {
        type: DataTypes.STRING(5000),
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
      tableName: "user_status_change_reasons",
      sequelize: connection,
    },
  );
}
