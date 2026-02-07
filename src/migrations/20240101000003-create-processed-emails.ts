import { QueryInterface, DataTypes } from "sequelize";

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  await queryInterface.createTable("processed_emails", {
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
      unique: true,
    },
    history_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    subject: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sender_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    recipient_email: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cc_email: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    bcc_email: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    attachments: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    attachments_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    thread_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    received_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
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

  await queryInterface.addIndex("processed_emails", ["mailbox_id"], {
    name: "idx_processed_emails_mailbox_id",
  });

  await queryInterface.addIndex("processed_emails", ["gmail_message_id"], {
    name: "idx_processed_emails_gmail_message_id",
  });

  await queryInterface.addIndex("processed_emails", ["thread_id"], {
    name: "idx_processed_emails_thread_id",
  });

  await queryInterface.addIndex("processed_emails", ["received_at"], {
    name: "idx_processed_emails_received_at",
  });
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  await queryInterface.dropTable("processed_emails");
};
