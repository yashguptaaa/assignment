export interface PubSubMessage {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
    attributes?: Record<string, string>;
  };
  subscription: string;
}

export interface PubSubNotification {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
    attributes?: {
      'googclient_channelid'?: string;
      'googclient_channelexpiration'?: string;
      'googclient_channeltoken'?: string;
    };
  };
  subscription: string;
}

export interface GmailPushNotification {
  emailAddress: string;
  historyId: string;
}

