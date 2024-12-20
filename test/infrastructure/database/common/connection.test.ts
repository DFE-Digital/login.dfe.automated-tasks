import { connection, DatabaseName } from "../../../../src/infrastructure/database/common/connection";
import { Sequelize } from "sequelize";
import { checkEnv } from "../../../../src/infrastructure/utils";

jest.mock("sequelize", () => ({
  Sequelize: jest.fn(),
}));
jest.mock("../../../../src/infrastructure/utils");

describe("When building a sequelize connection", () => {
  const originalEnv = { ...process.env };
  const sequelizeConstructor = Sequelize as unknown as jest.Mock;
  const checkEnvMock = jest.mocked(checkEnv);

  beforeEach(() => {
    process.env = {};
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("it will call checkEnv with the required environment variables and name for connecting to the specified database", () => {
    const databaseName = DatabaseName.Directories;
    const databaseEnvName = databaseName.toUpperCase();
    connection(databaseName);

    expect(checkEnvMock).toHaveBeenCalled();
    expect(checkEnvMock).toHaveBeenCalledWith([
      `DATABASE_${databaseEnvName}_HOST`,
      `DATABASE_${databaseEnvName}_NAME`,
      `DATABASE_${databaseEnvName}_USERNAME`,
      `DATABASE_${databaseEnvName}_PASSWORD`,
    ], "database");
  });

  it("it will throw an error if checkEnv throws an error when any required environment variables are not set", () => {
    const errorMessage = "Test Error";
    checkEnvMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    expect(() => connection(DatabaseName.Directories)).toThrow(errorMessage);
  });

  it("it will create a sequelize connection with the expected options if all required environment variables are set", () => {
    const databaseName = DatabaseName.Directories;
    const databaseEnvPrefix = `DATABASE_${databaseName.toUpperCase()}`;
    process.env[`${databaseEnvPrefix}_HOST`] = "Testing Host";
    process.env[`${databaseEnvPrefix}_NAME`] = "Testing Name";
    process.env[`${databaseEnvPrefix}_USERNAME`] = "Testing Username";
    process.env[`${databaseEnvPrefix}_PASSWORD`] = "Testing Password";
    connection(databaseName);

    expect(sequelizeConstructor).toHaveBeenCalled();
    expect(sequelizeConstructor).toHaveBeenCalledWith(
      process.env.DATABASE_DIRECTORIES_NAME,
      process.env.DATABASE_DIRECTORIES_USERNAME,
      process.env.DATABASE_DIRECTORIES_PASSWORD,
      {
        host: process.env.DATABASE_DIRECTORIES_HOST,
        dialect: "mssql",
        dialectOptions: {
          encrypt: true,
        },
        logging: false,
        retry: {
          match: [
            /SequelizeConnectionError/,
            /SequelizeConnectionRefusedError/,
            /SequelizeHostNotFoundError/,
            /SequelizeHostNotReachableError/,
            /SequelizeInvalidConnectionError/,
            /SequelizeConnectionTimedOutError/,
            /TimeoutError/,
          ],
          name: "Sequelize Connection",
          backoffBase: 100,
          backoffExponent: 1.1,
          timeout: 150000,
          max: 5,
        },
      },
    );
  });

  it.each([
    [console.log, "true"],
    [false, "false"],
    [false, undefined],
  ])("it will set the logging option to %p when process.env.DEBUG is set to %p", (result, envValue) => {
    process.env.DEBUG = envValue;
    connection(DatabaseName.Directories);

    expect(sequelizeConstructor).toHaveBeenCalled();
    expect(sequelizeConstructor.mock.calls[0][3].logging).toEqual(result);
  });
});
