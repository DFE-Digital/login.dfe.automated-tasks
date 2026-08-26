import { DataTypes, type Sequelize } from "sequelize";
import { initialiseUser, User } from "../directories/User";
import {
  initialiseUserPasswordPolicy,
  UserPasswordPolicy,
} from "../directories/UserPasswordPolicy";
import { initialiseInvitation, Invitation } from "../directories/Invitation";
import {
  initialiseInvitationCallback,
  InvitationCallback,
} from "../directories/InvitationCallback";
import { initialiseUserBanner } from "../organisations/UserBanner";
import { initialiseUserOrganisationRequest } from "../organisations/UserOrganisationRequest";
import { initialiseUserServiceRequest } from "../organisations/UserServiceRequest";
import { initialiseUserStatusChangeReason } from "../directories/UserStatusChangeReason";
import { initialiseUserLegacyUsername } from "../directories/UserLegacyUsername";
import { initialisePasswordHistory } from "../directories/PasswordHistory";
import { initialiseUserPasswordHistory } from "../directories/UserPasswordHistory";

/**
 * Initialise all "User..." models including User, and create model relationships.
 *
 * @param directoriesConnection - A {@link Sequelize} object connected to the directories database.
 * @param organisationsConnection - A {@link Sequelize} object connected to the organisations database.
 */
export function initialiseAllUserModels(
  directoriesConnection: Sequelize,
  organisationsConnection: Sequelize,
): void {
  initialiseUser(directoriesConnection);
  initialiseUserBanner(organisationsConnection);
  initialiseUserOrganisationRequest(organisationsConnection);
  initialiseUserPasswordPolicy(directoriesConnection);
  initialiseUserServiceRequest(organisationsConnection);

  User.hasMany(UserPasswordPolicy, {
    foreignKey: {
      name: "userId",
      field: "uid",
      allowNull: false,
    },
    keyType: DataTypes.UUID,
    as: "passwordPolicies",
  });
  UserPasswordPolicy.belongsTo(User, {
    as: "user",
  });
}

/**
 * Initialise all "Invitation..." models including Invitation, and create model relationships.
 *
 * @param directoriesConnection - A {@link Sequelize} object connected to the directories database.
 */
export function initialiseAllInvitationModels(
  directoriesConnection: Sequelize,
): void {
  initialiseInvitation(directoriesConnection);
  initialiseInvitationCallback(directoriesConnection);

  Invitation.hasMany(InvitationCallback, {
    foreignKey: {
      name: "invitationId",
      allowNull: false,
    },
    keyType: DataTypes.UUID,
    as: "callbacks",
  });
  InvitationCallback.belongsTo(Invitation, {
    as: "invitation",
  });
}

/**
 * Initialise the User model plus every model representing a user's identity records in the
 * directories database that don't have a dedicated relationship elsewhere, so they can be
 * queried/destroyed together (e.g. as part of permanently deleting an account).
 *
 * @param directoriesConnection - A {@link Sequelize} object connected to the directories database.
 */
export function initialiseAccountDeletionModels(
  directoriesConnection: Sequelize,
): void {
  initialiseUser(directoriesConnection);
  initialiseUserPasswordPolicy(directoriesConnection);
  initialiseUserStatusChangeReason(directoriesConnection);
  initialiseUserLegacyUsername(directoriesConnection);
  initialisePasswordHistory(directoriesConnection);
  initialiseUserPasswordHistory(directoriesConnection);
  initialiseInvitation(directoriesConnection);
}
