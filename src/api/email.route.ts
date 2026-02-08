import { Router } from "express";
import {
  getProcessedEmails,
  getProcessedEmailById,
  getEmailsByMailbox,
  getEmailsByThread,
} from "./email.controller";

const router = Router();

router.get("/", getProcessedEmails);
router.get("/:gmailMessageId", getProcessedEmailById);
router.get("/mailbox/:mailboxId", getEmailsByMailbox);
router.get("/thread/:threadId", getEmailsByThread);

export default router;
