import assert from "assert";

/**
 * Checks if the given required environment variables are present, if any are missing an error is thrown.
 *
 * @param variableNames - An array of environment variable names required to instantiate the object.
 * @param connectionType - The display name to put in an error if any required variables do not exist.
 *
 * @throws Error if any required environment variables are not set, to abort the function from running.
 */
export function checkEnv(variableNames: Array<string>, connectionType: string): void {
  const missingVariableNames = variableNames.filter((name) => {
    const value = process.env[name];
    return !(typeof value === "string" && value.length > 0);
  });
  const verb = missingVariableNames.length > 1 ? "are" : "is";

  assert(
    missingVariableNames.length === 0,
    `${missingVariableNames.join(", ")} ${verb} missing, cannot create ${connectionType} connection!`
  );
};
