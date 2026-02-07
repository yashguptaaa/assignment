import { Sequelize } from "sequelize";
import * as dotenv from "dotenv";

dotenv.config();

const config = {
  development: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    dialect:
      (process.env.DB_DIALECT as
        | "postgres"
        | "mysql"
        | "sqlite"
        | "mariadb"
        | "mssql") || "postgres",
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    dialect:
      (process.env.DB_DIALECT as
        | "postgres"
        | "mysql"
        | "sqlite"
        | "mariadb"
        | "mssql") || "postgres",
  },
  test: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    dialect:
      (process.env.DB_DIALECT as
        | "postgres"
        | "mysql"
        | "sqlite"
        | "mariadb"
        | "mssql") || "postgres",
  },
};

const env =
  (process.env.NODE_ENV as "development" | "production" | "test") ||
  "development";
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database || "",
  dbConfig.username || "",
  dbConfig.password || "",
  {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
    port: dbConfig.port,
    logging: false,
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: true,
    },
  },
);

export const initializeDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
  } catch (error) {
    throw new Error("Unable to connect to the database");
  }
};

export default sequelize;
export { config };
