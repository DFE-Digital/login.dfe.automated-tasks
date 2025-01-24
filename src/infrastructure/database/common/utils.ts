import { type Sequelize } from "sequelize";
import { initialiseUser, User } from "../directories/User";
import { initialiseUserPasswordPolicy, UserPasswordPolicy } from "../directories/UserPasswordPolicy";
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
