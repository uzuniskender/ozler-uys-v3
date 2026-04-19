// src/features/chat/types.ts
// ÖzlerMsg v1 — Kurumsal Mesajlaşma
// DB: uys_chat_* (canlı: lmhcobrgrnvtprvmcito, test: cowgxwmhlogmswatbltz)
// uys_kullanicilar kolonları: id(text), ad(text), kullanici_ad(text), rol(text), aktif(boolean)

export type ChatChannelType = 'dm' | 'group';
export type ChatMemberRole = 'owner' | 'admin' | 'member';

export interface ChatChannel {
  id: string;
  name: string | null;
  type: ChatChannelType;
  description: string | null;
  created_by: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface ChatMember {
  channel_id: string;
  user_id: string;
  role: ChatMemberRole;
  muted: boolean;
  last_read_at: string | null;
  joined_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  body: string;
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface ChatMention {
  message_id: string;
  user_id: string;
  read_at: string | null;
}

export interface ChatReaction {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ChatAttachment {
  id: string;
  message_id: string;
  storage_path: string;
  mime_type: string | null;
  file_name: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface ChatUserLite {
  id: string;
  ad: string | null;
  kullanici_ad: string;
  rol?: string;
}

/** Görüntü adı: ad > kullanici_ad > 'Bilinmeyen' */
export function getUserDisplayName(u: ChatUserLite | null | undefined): string {
  if (!u) return 'Bilinmeyen';
  return (u.ad && u.ad.trim()) || u.kullanici_ad || 'Bilinmeyen';
}

export interface ChatMessageView extends ChatMessage {
  sender?: ChatUserLite;
  attachments?: ChatAttachment[];
  reactions?: ChatReaction[];
  mentions?: ChatMention[];
  reply_to?: ChatMessage | null;
}

export interface ChatChannelView extends ChatChannel {
  members?: ChatMember[];
  last_message?: ChatMessage | null;
  unread_count?: number;
  other_user?: ChatUserLite;
}

export interface ChatSidebarItem {
  id: string;
  name: string;
  type: ChatChannelType;
  last_message_at: string | null;
  last_message_preview: string;
  unread_count: number;
  is_muted: boolean;
}

export interface SendMessageInput {
  channel_id: string;
  body: string;
  reply_to_id?: string | null;
  mentions?: string[];
}

export interface CreateDmInput {
  other_user_id: string;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  member_user_ids: string[];
}

export interface UpdateMessageInput {
  message_id: string;
  body: string;
}
