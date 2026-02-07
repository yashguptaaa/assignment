import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database.config";
import GmailMailboxConfig from "./GmailMailboxConfig";

interface WebhookNotificationAttributes {
  id: number;
  mailboxId: string;
  gmailMessageId: string;
  historyId: string;
  payload: Record<string, unknown> | null;
  errorMessage: string | null;
  receivedAt: Date;
  processedSt: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

interface WebhookNotificationCreationAttributes extends Optional<
  WebhookNotificationAttributes,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
  | "processedSt"
  | "payload"
  | "errorMessage"
  | "receivedAt"
> {}

class WebhookNotification
  extends Model<
    WebhookNotificationAttributes,
    WebhookNotificationCreationAttributes
  >
  implements WebhookNotificationAttributes
{
  public id!: number;
  public mailboxId!: string;
  public gmailMessageId!: string;
  public historyId!: string;
  public payload!: Record<string, unknown> | null;
  public errorMessage!: string | null;
  public receivedAt!: Date;
  public processedSt!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt!: Date | null;
}

WebhookNotification.init(
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
      field: "gmail_message_id",
    },
    historyId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "history_id",
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "error_message",
    },
    receivedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "received_at",
    },
    processedSt: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "pending",
      field: "processed_st",
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
    tableName: "webhook_notifications",
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
        fields: ["history_id"],
      },
      {
        fields: ["processed_st"],
      },
      {
        unique: true,
        fields: ["mailbox_id", "gmail_message_id", "history_id"],
      },
    ],
  },
);

WebhookNotification.belongsTo(GmailMailboxConfig, {
  foreignKey: "mailboxId",
  targetKey: "mailboxId",
});

export default WebhookNotification;
