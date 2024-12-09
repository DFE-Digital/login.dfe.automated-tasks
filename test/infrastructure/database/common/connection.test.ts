import { connection, DatabaseName } from "../../../../src/infrastructure/database/common/connection";
import { Sequelize } from "sequelize";

jest.mock("sequelize", () => ({
  Sequelize: jest.fn(),
}));

describe("When building a sequelize connection", () => {
  const originalEnv = { ...process.env };
  const sequelizeConstructor = Sequelize as unknown as jest.Mock;
  
  beforeEach(() => {
    process.env = {
      DATABASE_DIRECTORIES_HOST: "Testing",
      DATABASE_DIRECTORIES_NAME: "Testing",
      DATABASE_DIRECTORIES_USERNAME: "Testing",
      DATABASE_DIRECTORIES_PASSWORD: "Testing",
    };
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });

  it.each([
    "HOST",
    "NAME",
    "USERNAME",
    "PASSWORD",
  ])("it will throw an error if any required environment variables are not set (%p)", (variable) => {
    const dbName = DatabaseName.Directories;
    const dbEnvName = dbName.toUpperCase();
    delete process.env[`DATABASE_${dbEnvName}_${variable}`];

    expect(() => connection(dbName)).toThrow(`DATABASE_${dbEnvName}_${variable} is missing, cannot create database connection!`);
  });

  it("it will create a sequelize connection with the expected options if all required environment variables are set", () => {
    connection(DatabaseName.Directories);

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
