import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database.config";

interface GmailMailboxConfigAttributes {
  id: number;
  mailboxId: string;
  clientId: string;
  userEmail: string;
  accessToken: string;
  refreshToken: string;
  pubsubChannelId: string;
  pubsubTopicName: string;
  tokenExpiry: Date;
  isMailboxEnabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

interface GmailMailboxConfigCreationAttributes extends Optional<
  GmailMailboxConfigAttributes,
  "id" | "createdAt" | "updatedAt" | "deletedAt" | "isMailboxEnabled"
> {}

class GmailMailboxConfig
  extends Model<
    GmailMailboxConfigAttributes,
    GmailMailboxConfigCreationAttributes
  >
  implements GmailMailboxConfigAttributes
{
  public id!: number;
  public mailboxId!: string;
  public clientId!: string;
  public userEmail!: string;
  public accessToken!: string;
  public refreshToken!: string;
  public pubsubChannelId!: string;
  public pubsubTopicName!: string;
  public tokenExpiry!: Date;
  public isMailboxEnabled!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public deletedAt!: Date | null;
}

GmailMailboxConfig.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    mailboxId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: "mailbox_id",
    },
    clientId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "client_id",
    },
    userEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "user_email",
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "access_token",
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "refresh_token",
    },
    pubsubChannelId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: "pubsub_channel_id",
    },
    pubsubTopicName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "pubsub_topic_name",
    },
    tokenExpiry: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "token_expiry",
    },
    isMailboxEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_mailbox_enabled",
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
    tableName: "gmail_mailbox_config",
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        fields: ["mailbox_id"],
      },
      {
        fields: ["pubsub_channel_id"],
      },
      {
        fields: ["user_email"],
      },
    ],
  },
);

export default GmailMailboxConfig;
