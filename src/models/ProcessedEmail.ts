import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database.config";
import GmailMailboxConfig from "./GmailMailboxConfig";

interface ProcessedEmailAttributes {
  id: number;
  mailboxId: string;
  gmailMessageId: string;
  historyId: string;
  subject: string | null;
  senderEmail: string | null;
  recipientEmail: string | null;
  ccEmail: string | null;
  bccEmail: string | null;
  body: string | null;
  attachments: Record<string, unknown> | null;
  attachmentsCount: number;
  threadId: string | null;
  receivedAt: Date | null;
  processedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

interface ProcessedEmailCreationAttributes extends Optional<
  ProcessedEmailAttributes,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
  | "processedAt"
  | "attachmentsCount"
  | "subject"
  | "senderEmail"
  | "recipientEmail"
  | "ccEmail"
  | "bccEmail"
  | "body"
  | "attachments"
  | "threadId"
  | "receivedAt"
> {}

class ProcessedEmail
  extends Model<ProcessedEmailAttributes, ProcessedEmailCreationAttributes>
  implements ProcessedEmailAttributes
{
  public id!: number;
  public mailboxId!: string;
  public gmailMessageId!: string;
  public historyId!: string;
  public subject!: string | null;
  public senderEmail!: string | null;
  public recipientEmail!: string | null;
  public ccEmail!: string | null;
  public bccEmail!: string | null;
  public body!: string | null;
  public attachments!: Record<string, unknown> | null;
  public attachmentsCount!: number;
  public threadId!: string | null;
  public receivedAt!: Date | null;
  public processedAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt!: Date | null;
}

ProcessedEmail.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    mailboxId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "mailbox_id",
      references: {
        model: GmailMailboxConfig,
        key: "mailbox_id",
      },
    },
    gmailMessageId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: "gmail_message_id",
    },
    historyId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "history_id",
    },
    subject: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "subject",
    },
    senderEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "sender_email",
    },
    recipientEmail: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "recipient_email",
    },
    ccEmail: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "cc_email",
    },
    bccEmail: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "bcc_email",
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    attachments: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    attachmentsCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "attachments_count",
    },
    threadId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "thread_id",
    },
    receivedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "received_at",
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "processed_at",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "updated_at",
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "deleted_at",
    },
  },
  {
    sequelize,
    tableName: "processed_emails",
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        fields: ["mailbox_id"],
      },
      {
        fields: ["gmail_message_id"],
      },
      {
        fields: ["thread_id"],
      },
      {
        fields: ["received_at"],
      },
    ],
  },
);

ProcessedEmail.belongsTo(GmailMailboxConfig, {
  foreignKey: "mailboxId",
  targetKey: "mailboxId",
});

export default ProcessedEmail;
