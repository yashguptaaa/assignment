import express from "express";
import * as dotenv from "dotenv";
import { initializeDatabase } from "./config/database.config";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const startServer = async (): Promise<void> => {
  await initializeDatabase();
  app.listen(PORT);
};

startServer();
