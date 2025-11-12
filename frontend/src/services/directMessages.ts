import api from '../lib/api';

type ApiDirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
};

type ApiDirectMessagePage = {
  messages: ApiDirectMessage[];
};

export type DirectMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
};

function normalizeMessage(payload: ApiDirectMessage): DirectMessage {
  return {
    id: payload.id,
    senderId: payload.sender_id,
    recipientId: payload.recipient_id,
    content: payload.content,
    createdAt: payload.created_at,
  };
}

export const directMessagesService = {
  async list(partnerId: string, limit = 50): Promise<DirectMessage[]> {
    const { data } = await api.get<ApiDirectMessagePage>(`/direct-messages/${partnerId}`, {
      params: { limit },
    });
    return data.messages.map(normalizeMessage);
  },
  async send(partnerId: string, content: string): Promise<DirectMessage> {
    const { data } = await api.post<ApiDirectMessage>(`/direct-messages/${partnerId}`, { content });
    return normalizeMessage(data);
  },
};
