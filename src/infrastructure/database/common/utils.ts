import { DataTypes, type Sequelize } from "sequelize";
import { initialiseUser, User } from "../directories/User";
import { initialiseUserPasswordPolicy, UserPasswordPolicy } from "../directories/UserPasswordPolicy";
import { initialiseInvitation, Invitation } from "../directories/Invitation";
import { initialiseInvitationCallback, InvitationCallback } from "../directories/InvitationCallback";
import { initialiseUserBanner } from "../organisations/UserBanner";
import { initialiseUserOrganisationRequest } from "../organisations/UserOrganisationRequest";
import { initialiseUserServiceRequest } from "../organisations/UserServiceRequest";

/**
 * Initialise all "User..." models including User, and create model relationships.
 *
 * @param directoriesConnection - A {@link Sequelize} object connected to the directories database.
 * @param organisationsConnection - A {@link Sequelize} object connected to the organisations database.
 */
export function initialiseAllUserModels(directoriesConnection: Sequelize, organisationsConnection: Sequelize): void {
  initialiseUser(directoriesConnection);
  initialiseUserBanner(organisationsConnection);
  initialiseUserOrganisationRequest(organisationsConnection);
  initialiseUserPasswordPolicy(directoriesConnection);
  initialiseUserServiceRequest(organisationsConnection);

  const userPasswordPolicyFk = {
    name: "userId",
    field: "uid",
  };

  User.hasMany(UserPasswordPolicy, {
    foreignKey: userPasswordPolicyFk,
    as: "passwordPolicies",
  });
  UserPasswordPolicy.belongsTo(User, {
    foreignKey: userPasswordPolicyFk,
    as: "user",
  });
};

/**
 * Initialise all "Invitation..." models including Invitation, and create model relationships.
 *
 * @param directoriesConnection - A {@link Sequelize} object connected to the directories database.
 */
export function initialiseAllInvitationModels(directoriesConnection: Sequelize): void {
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
};
