import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize,
} from "sequelize";
import { Invitation } from "./Invitation";

/**
 * Invitation Callback schema model for CRUD operations the API doesn't currently support.
 */
export class InvitationCallback extends Model<
  InferAttributes<InvitationCallback>,
  InferCreationAttributes<InvitationCallback>
> {
  declare invitationId: ForeignKey<Invitation["id"]>;
  declare sourceId: string;
  declare callbackUrl: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare clientId: string | null;
  declare invitation?: NonAttribute<Invitation>;
}

/**
 * Initialise the InvitationCallback model with the data types and fields expected by the database.
 *
 * @param connection - A {@link Sequelize} object connected to a database.
 */
export function initialiseInvitationCallback(connection: Sequelize): void {
  InvitationCallback.init(
    {
      invitationId: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
      },
      sourceId: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        allowNull: false,
      },
      callbackUrl: {
        type: DataTypes.STRING(1024),
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
      clientId: {
        type: DataTypes.STRING(50),
      },
    },
    {
      tableName: "invitation_callback",
      sequelize: connection,
    },
  );
}
