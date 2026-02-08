import { Request, Response } from "express";
import { ProcessedEmail } from "../models";
import { Op } from "sequelize";

export const getProcessedEmails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const mailboxId = req.query.mailboxId as string | undefined;
    const gmailMessageId = req.query.gmailMessageId as string | undefined;
    const threadId = req.query.threadId as string | undefined;
    const limit = parseInt((req.query.limit as string) || "50", 10);
    const offset = parseInt((req.query.offset as string) || "0", 10);

    const where: Record<string, unknown> = {
      deletedAt: {
        [Op.is]: null,
      },
    };

    if (mailboxId) {
      where.mailboxId = mailboxId;
    }

    if (gmailMessageId) {
      where.gmailMessageId = gmailMessageId;
    }

    if (threadId) {
      where.threadId = threadId;
    }

    const { count, rows } = await ProcessedEmail.findAndCountAll({
      where,
      limit: Math.min(limit, 100),
      offset,
      order: [["processedAt", "DESC"]],
    });

    res.status(200).json({
      total: count,
      limit,
      offset,
      emails: rows,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
};

export const getProcessedEmailById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const gmailMessageId = req.params.gmailMessageId;

    const email = await ProcessedEmail.findOne({
      where: {
        gmailMessageId,
        deletedAt: {
          [Op.is]: null,
        },
      },
    });

    if (!email) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    res.status(200).json(email);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
};

export const getEmailsByMailbox = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const mailboxId = req.params.mailboxId;
    const limit = parseInt((req.query.limit as string) || "50", 10);
    const offset = parseInt((req.query.offset as string) || "0", 10);

    const { count, rows } = await ProcessedEmail.findAndCountAll({
      where: {
        mailboxId,
        deletedAt: {
          [Op.is]: null,
        },
      },
      limit: Math.min(limit, 100),
      offset,
      order: [["processedAt", "DESC"]],
    });

    res.status(200).json({
      mailboxId,
      total: count,
      limit,
      offset,
      emails: rows,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
};

export const getEmailsByThread = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const threadId = req.params.threadId;
    const limit = parseInt((req.query.limit as string) || "50", 10);
    const offset = parseInt((req.query.offset as string) || "0", 10);

    const { count, rows } = await ProcessedEmail.findAndCountAll({
      where: {
        threadId,
        deletedAt: {
          [Op.is]: null,
        },
      },
      limit: Math.min(limit, 100),
      offset,
      order: [["receivedAt", "ASC"]],
    });

    res.status(200).json({
      threadId,
      total: count,
      limit,
      offset,
      emails: rows,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
};
