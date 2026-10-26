import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  Sequelize,
} from "sequelize";

/**
 * Password History schema model for CRUD operations the API doesn't currently support.
 *
 * Rows are linked to a user only indirectly, via the {@link UserPasswordHistory} join table.
 */
export class PasswordHistory extends Model<
  InferAttributes<PasswordHistory>,
  InferCreationAttributes<PasswordHistory>
> {
  declare id: string;
  declare password: string;
  declare salt: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

/**
 * Initialise the PasswordHistory model with the data types and fields expected by the database.
 *
 * @param connection - A {@link Sequelize} object connected to a database.
 */
export function initialisePasswordHistory(connection: Sequelize): void {
  PasswordHistory.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        unique: true,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING(5000),
        allowNull: false,
      },
      salt: {
        type: DataTypes.STRING(500),
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
      tableName: "password_history",
      sequelize: connection,
    },
  );
}
