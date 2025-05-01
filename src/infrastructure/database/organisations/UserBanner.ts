import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  Sequelize,
} from "sequelize";

/**
 * User Banner schema model for CRUD operations the API doesn't currently support.
 */
export class UserBanner extends Model<
  InferAttributes<UserBanner>,
  InferCreationAttributes<UserBanner>
> {
  declare id: string;
  declare userId: string;
  declare bannerId: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare bannerData: string | null;
}

/**
 * Initialise the UserBanner model with the data types and fields expected by the database.
 *
 * @param connection - A {@link Sequelize} object connected to a database.
 */
export function initialiseUserBanner(connection: Sequelize): void {
  UserBanner.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      bannerId: {
        type: DataTypes.INTEGER,
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
      bannerData: {
        type: DataTypes.STRING(1000),
      },
    },
    {
      tableName: "user_banners",
      sequelize: connection,
    },
  );
}
