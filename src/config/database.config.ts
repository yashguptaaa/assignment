import { Sequelize } from "sequelize";

// IMPORTANT: require(), not import (CommonJS file)
const dbConfig = require("./sequelize-cli.config");

const env =
  (process.env.NODE_ENV as "development" | "production" | "test") ||
  "development";

const config = dbConfig[env];

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    port: config.port,
    dialect: config.dialect,
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
    console.log("✅ Database connected");
  } catch (error) {
    throw new Error(
      `Unable to connect to database: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
};

export default sequelize;
