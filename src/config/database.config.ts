import * as dotenv from "dotenv";
import { Sequelize } from "sequelize";

dotenv.config();

const config = {
  development: {
    username: process.env.DB_USERNAME || "",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_DATABASE || "",
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    dialect: "postgres",
  },
  production: {
    username: process.env.DB_USERNAME || "",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_DATABASE || "",
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    dialect: "postgres",
  },
  test: {
    username: process.env.DB_USERNAME || "",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_DATABASE || "",
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    dialect: "postgres",
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
    dialect: "postgres",
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
    dialectOptions: {
      connectTimeout: 10000,
    },
  },
);

export const initializeDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Unable to connect to the database: ${errorMessage}`);
  }
};

export default sequelize;
export { config };
