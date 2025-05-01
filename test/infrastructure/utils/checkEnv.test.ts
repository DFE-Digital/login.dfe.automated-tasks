import { checkEnv } from "../../../src/infrastructure/utils";

describe("checkEnv utility function", () => {
  const originalEnv = { ...process.env };
  const connectionType = "testing";
  const testVariableNames = ["test1", "test2", "test3"];

  beforeEach(() => {
    process.env = {};
    testVariableNames.forEach((name) => {
      process.env[name] = "testing";
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("it will throw an error with the missing variable name, if one required environment variables is not present", () => {
    const missingVariable = testVariableNames[0];
    delete process.env[missingVariable];
    expect(() => checkEnv(testVariableNames, connectionType)).toThrow(
      `${missingVariable} is missing, cannot create ${connectionType} connection!`,
    );
  });

  it("it will throw an error with the names of all missing variables, if multiple required environment variables is not present", () => {
    const missingVariables = testVariableNames.slice(0, 2);
    missingVariables.forEach((name) => delete process.env[name]);

    expect(() => checkEnv(testVariableNames, connectionType)).toThrow(
      `${missingVariables.join(", ")} are missing, cannot create ${connectionType} connection!`,
    );
  });

  it("it will throw an error with the names of all missing variables, if all required environment variables is not present", () => {
    testVariableNames.forEach((name) => delete process.env[name]);

    expect(() => checkEnv(testVariableNames, connectionType)).toThrow(
      `${testVariableNames.join(", ")} are missing, cannot create ${connectionType} connection!`,
    );
  });

  it("it will not throw an error if all required environment variables are present", () => {
    expect(() => checkEnv(testVariableNames, connectionType)).not.toThrow();
  });
});
