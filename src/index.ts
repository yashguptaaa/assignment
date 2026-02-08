import express from "express";
import * as dotenv from "dotenv";

dotenv.config();

import "./config/database.config";
import "./models";
import webhookRoutes from "./api/webhook.route";
import { initializeDatabase } from "./config/database.config";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/webhook", webhookRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

const startServer = async (): Promise<void> => {
  try {
    await initializeDatabase();
    console.log("✅ Database connected successfully");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
