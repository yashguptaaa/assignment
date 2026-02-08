import { Router } from "express";
import { handleGmailWebhook } from "./webhook.controller";

const router = Router();

router.post("/gmail", handleGmailWebhook);

export default router;
