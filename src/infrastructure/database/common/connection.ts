import { Sequelize } from "sequelize";
import { checkEnv } from "../../utils";

/**
 * Names of databases currently accepted by this application.
 */
export enum DatabaseName {
  Directories = "directories",
};

/**
 * Creates a Sequelize instance for the specified database name, using environment variables for credentials.
 *
 * @param database - The database name ({@link DatabaseName}) to connect to using environment variables.
 * @returns The requested database connection ({@link Sequelize}).
 *
 * @throws Error when required environment variables are missing, or sequelize errors if the database fails to connect.
 */
export function connection(database: DatabaseName): Sequelize {
  const dbEnvName = database.toUpperCase();

  checkEnv([
    `DATABASE_${dbEnvName}_HOST`,
    `DATABASE_${dbEnvName}_NAME`,
    `DATABASE_${dbEnvName}_USERNAME`,
    `DATABASE_${dbEnvName}_PASSWORD`,
  ], "database");

  return new Sequelize(
    process.env[`DATABASE_${dbEnvName}_NAME`],
    process.env[`DATABASE_${dbEnvName}_USERNAME`],
    process.env[`DATABASE_${dbEnvName}_PASSWORD`],
    {
      host: process.env[`DATABASE_${dbEnvName}_HOST`],
      dialect: "mssql",
      dialectOptions: {
        encrypt: true,
      },
      logging: process.env.DEBUG?.toLowerCase() === "true" ? console.log : false,
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
};
