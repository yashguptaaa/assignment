import { QueryInterface, DataTypes } from "sequelize";

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  await queryInterface.createTable("gmail_mailbox_config", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    mailbox_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    client_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    user_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    access_token: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    pubsub_channel_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    pubsub_topic_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    token_expiry: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_mailbox_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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

  await queryInterface.addIndex("gmail_mailbox_config", ["mailbox_id"], {
    name: "idx_gmail_mailbox_config_mailbox_id",
  });

  await queryInterface.addIndex("gmail_mailbox_config", ["pubsub_channel_id"], {
    name: "idx_gmail_mailbox_config_pubsub_channel_id",
  });

  await queryInterface.addIndex("gmail_mailbox_config", ["user_email"], {
    name: "idx_gmail_mailbox_config_user_email",
  });
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  await queryInterface.dropTable("gmail_mailbox_config");
};
