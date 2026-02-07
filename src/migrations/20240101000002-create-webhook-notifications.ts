import { QueryInterface, DataTypes } from "sequelize";

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  await queryInterface.createTable("webhook_notifications", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    mailbox_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      references: {
        model: "gmail_mailbox_config",
        key: "mailbox_id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    gmail_message_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    history_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    received_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    processed_st: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "pending",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  await queryInterface.addIndex("webhook_notifications", ["mailbox_id"], {
    name: "idx_webhook_notifications_mailbox_id",
  });

  await queryInterface.addIndex("webhook_notifications", ["gmail_message_id"], {
    name: "idx_webhook_notifications_gmail_message_id",
  });

  await queryInterface.addIndex("webhook_notifications", ["history_id"], {
    name: "idx_webhook_notifications_history_id",
  });

  await queryInterface.addIndex("webhook_notifications", ["processed_st"], {
    name: "idx_webhook_notifications_processed_st",
  });

  await queryInterface.addIndex(
    "webhook_notifications",
    ["mailbox_id", "gmail_message_id", "history_id"],
    {
      unique: true,
      name: "webhook_notifications_mailbox_id_gmail_message_id_history_id_unique",
    },
  );
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  await queryInterface.dropTable("webhook_notifications");
};
