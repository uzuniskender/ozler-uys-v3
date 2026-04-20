// src/features/chat/chatService.ts
// ÖzlerMsg v1 — Supabase CRUD + Realtime
// uys_kullanicilar: id, ad, kullanici_ad, rol, aktif

import { supabase } from '../../lib/supabase';
import type {
  ChatChannel,
  ChatMessage,
  ChatUserLite,
  ChatSidebarItem,
  SendMessageInput,
  CreateGroupInput,
  UpdateMessageInput,
} from './types';
import { getUserDisplayName } from './types';

// ============================================================
// KANAL / DM İŞLEMLERİ
// ============================================================

export async function getOrCreateDm(
  currentUserId: string,
  otherUserId: string
): Promise<ChatChannel> {
  if (currentUserId === otherUserId) {
    throw new Error('Kendinize DM gönderemezsiniz');
  }

  const { data: existing, error: err1 } = await supabase
    .from('uys_chat_channels')
    .select('id, name, type, description, created_by, archived_at, created_at, uys_chat_members!inner(user_id)')
    .eq('type', 'dm');

  if (err1) throw err1;

  if (existing) {
    for (const ch of existing as any[]) {
      const memberIds: string[] = (ch.uys_chat_members || []).map((m: any) => m.user_id);
      if (memberIds.includes(currentUserId) && memberIds.includes(otherUserId) && memberIds.length === 2) {
        const { uys_chat_members, ...clean } = ch;
        return clean as ChatChannel;
      }
    }
  }

  const { data: newChannel, error: err2 } = await supabase
    .from('uys_chat_channels')
    .insert({ type: 'dm', created_by: currentUserId })
    .select()
    .single();

  if (err2) throw err2;

  const { error: err3 } = await supabase
    .from('uys_chat_members')
    .insert([
      { channel_id: newChannel.id, user_id: currentUserId, role: 'member' },
      { channel_id: newChannel.id, user_id: otherUserId, role: 'member' },
    ]);

  if (err3) throw err3;

  return newChannel as ChatChannel;
}

export async function createGroup(
  currentUserId: string,
  input: CreateGroupInput
): Promise<ChatChannel> {
  const { data: channel, error: err1 } = await supabase
    .from('uys_chat_channels')
    .insert({
      type: 'group',
      name: input.name,
      description: input.description ?? null,
      created_by: currentUserId,
    })
    .select()
    .single();

  if (err1) throw err1;

  const allMemberIds = Array.from(new Set([currentUserId, ...input.member_user_ids]));
  const rows = allMemberIds.map((uid) => ({
    channel_id: channel.id,
    user_id: uid,
    role: uid === currentUserId ? 'owner' : 'member',
  }));

  const { error: err2 } = await supabase.from('uys_chat_members').insert(rows);
  if (err2) throw err2;

  return channel as ChatChannel;
}

export async function addMemberToGroup(channelId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('uys_chat_members')
    .insert({ channel_id: channelId, user_id: userId, role: 'member' });
  if (error) throw error;
}

export async function removeMemberFromGroup(channelId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('uys_chat_members')
    .delete()
    .eq('channel_id', channelId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ============================================================
// SIDEBAR
// ============================================================

export async function getSidebarChannels(currentUserId: string): Promise<ChatSidebarItem[]> {
  const { data: memberRows, error: err1 } = await supabase
    .from('uys_chat_members')
    .select('channel_id, last_read_at, muted')
    .eq('user_id', currentUserId);

  if (err1) throw err1;
  if (!memberRows || memberRows.length === 0) return [];

  const channelIds = memberRows.map((m: any) => m.channel_id);

  const { data: channels, error: err2 } = await supabase
    .from('uys_chat_channels')
    .select('*')
    .in('id', channelIds)
    .is('archived_at', null);

  if (err2) throw err2;
  if (!channels) return [];

  const dmChannelIds = channels.filter((c: any) => c.type === 'dm').map((c: any) => c.id);
  const otherUserMap: Record<string, ChatUserLite> = {};

  if (dmChannelIds.length > 0) {
    const { data: dmMembers } = await supabase
      .from('uys_chat_members')
      .select('channel_id, user_id')
      .in('channel_id', dmChannelIds)
      .neq('user_id', currentUserId);

    if (dmMembers && dmMembers.length > 0) {
      const otherIds = Array.from(new Set(dmMembers.map((m: any) => m.user_id)));
      const { data: users } = await supabase
        .from('uys_kullanicilar')
        .select('id, ad, kullanici_ad, rol')
        .in('id', otherIds);

      if (users) {
        const userById: Record<string, ChatUserLite> = {};
        users.forEach((u: any) => { userById[u.id] = u; });
        dmMembers.forEach((m: any) => {
          if (userById[m.user_id]) otherUserMap[m.channel_id] = userById[m.user_id];
        });
      }
    }
  }

  const result: ChatSidebarItem[] = [];
  const memberByChannel: Record<string, any> = {};
  memberRows.forEach((m: any) => { memberByChannel[m.channel_id] = m; });

  for (const ch of channels as any[]) {
    const myMember = memberByChannel[ch.id];

    const { data: lastMsgArr } = await supabase
      .from('uys_chat_messages')
      .select('body, created_at')
      .eq('channel_id', ch.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    const lastMsg = lastMsgArr && lastMsgArr[0];

    let unreadCount = 0;
    if (myMember?.last_read_at) {
      const { count } = await supabase
        .from('uys_chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', ch.id)
        .is('deleted_at', null)
        .neq('user_id', currentUserId)
        .gt('created_at', myMember.last_read_at);
      unreadCount = count ?? 0;
    } else {
      const { count } = await supabase
        .from('uys_chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', ch.id)
        .is('deleted_at', null)
        .neq('user_id', currentUserId);
      unreadCount = count ?? 0;
    }

    const displayName = ch.type === 'dm'
      ? getUserDisplayName(otherUserMap[ch.id])
      : (ch.name ?? 'İsimsiz Kanal');

    result.push({
      id: ch.id,
      name: displayName,
      type: ch.type,
      last_message_at: lastMsg?.created_at ?? ch.created_at,
      last_message_preview: lastMsg?.body?.slice(0, 80) ?? '',
      unread_count: unreadCount,
      is_muted: myMember?.muted ?? false,
    });
  }

  result.sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''));
  return result;
}

// ============================================================
// MESAJ
// ============================================================

export async function getMessages(
  channelId: string,
  limit = 50,
  beforeCreatedAt?: string
): Promise<ChatMessage[]> {
  let q = supabase
    .from('uys_chat_messages')
    .select('*')
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (beforeCreatedAt) q = q.lt('created_at', beforeCreatedAt);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).reverse() as ChatMessage[];
}

export async function getMessagesWithSenders(
  channelId: string,
  limit = 50
): Promise<{ messages: ChatMessage[]; senders: Record<string, ChatUserLite> }> {
  const messages = await getMessages(channelId, limit);

  const senderIds = Array.from(new Set(messages.map((m) => m.user_id).filter(Boolean)));
  const senders: Record<string, ChatUserLite> = {};

  if (senderIds.length > 0) {
    const { data: users } = await supabase
      .from('uys_kullanicilar')
      .select('id, ad, kullanici_ad, rol')
      .in('id', senderIds);

    if (users) users.forEach((u: any) => { senders[u.id] = u; });
  }

  return { messages, senders };
}

export async function sendMessage(
  currentUserId: string,
  input: SendMessageInput
): Promise<ChatMessage> {
  const { data: msg, error: err1 } = await supabase
    .from('uys_chat_messages')
    .insert({
      channel_id: input.channel_id,
      user_id: currentUserId,
      body: input.body,
      reply_to_id: input.reply_to_id ?? null,
    })
    .select()
    .single();

  if (err1) throw err1;

  if (input.mentions && input.mentions.length > 0) {
    const rows = input.mentions.map((uid) => ({
      message_id: msg.id,
      user_id: uid,
    }));
    const { error: err2 } = await supabase.from('uys_chat_mentions').insert(rows);
    if (err2) console.warn('Mention insert failed:', err2);
  }

  return msg as ChatMessage;
}

export async function updateMessage(input: UpdateMessageInput): Promise<void> {
  const { error } = await supabase
    .from('uys_chat_messages')
    .update({ body: input.body, edited_at: new Date().toISOString() })
    .eq('id', input.message_id);
  if (error) throw error;
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('uys_chat_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

// ============================================================
// OKUNMUŞ / OKUNMAMIŞ
// ============================================================

export async function markChannelRead(currentUserId: string, channelId: string): Promise<void> {
  const { error } = await supabase
    .from('uys_chat_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('channel_id', channelId)
    .eq('user_id', currentUserId);
  if (error) throw error;
}

export async function getTotalUnreadCount(currentUserId: string): Promise<number> {
  const items = await getSidebarChannels(currentUserId);
  return items.reduce((sum, it) => sum + it.unread_count, 0);
}

// ============================================================
// REAKSİYON
// ============================================================

export async function addReaction(
  messageId: string,
  currentUserId: string,
  emoji: string
): Promise<void> {
  const { error } = await supabase
    .from('uys_chat_reactions')
    .insert({ message_id: messageId, user_id: currentUserId, emoji });
  if (error && error.code !== '23505') throw error;
}

export async function removeReaction(
  messageId: string,
  currentUserId: string,
  emoji: string
): Promise<void> {
  const { error } = await supabase
    .from('uys_chat_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', currentUserId)
    .eq('emoji', emoji);
  if (error) throw error;
}

// ============================================================
// KULLANICI LİSTESİ
// ============================================================

export async function getAllActiveUsers(excludeUserId?: string): Promise<ChatUserLite[]> {
  let q = supabase
    .from('uys_kullanicilar')
    .select('id, ad, kullanici_ad, rol')
    .eq('aktif', true)
    .order('ad');

  if (excludeUserId) q = q.neq('id', excludeUserId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ChatUserLite[];
}

// ============================================================
// REALTIME
// ============================================================

export function subscribeToChannelMessages(
  channelId: string,
  onInsert: (msg: ChatMessage) => void,
  onUpdate?: (msg: ChatMessage) => void
) {
  const channel = supabase
    .channel(`chat-${channelId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'uys_chat_messages',
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => onInsert(payload.new as ChatMessage)
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'uys_chat_messages',
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => onUpdate?.(payload.new as ChatMessage)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToAllUserMessages(
  currentUserId: string,
  onAnyNewMessage: (msg: ChatMessage) => void
) {
  const channel = supabase
    .channel(`chat-all-${currentUserId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'uys_chat_messages',
      },
      (payload) => {
        const msg = payload.new as ChatMessage;
        if (msg.user_id !== currentUserId) onAnyNewMessage(msg);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
// ============================================================
// MENTION (v15.17)
// ============================================================

/**
 * Mesaj gövdesinden @kullanici_ad ifadelerini yakalar.
 * Kural: @ işaretinden sonra harf/rakam/nokta/altçizgi (Türkçe karakter dahil).
 * Örn: "Selam @buket.uzun ve @okan" → ["buket.uzun", "okan"]
 */
export function extractMentionHandles(body: string): string[] {
  // \p{L} Unicode letter — Türkçe karakterleri yakalar
  const re = /@([\p{L}0-9._]+)/gu;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    found.add(m[1].toLowerCase());
  }
  return Array.from(found);
}

/**
 * Handle listesini uys_kullanicilar id'lerine çevirir.
 * kullanici_ad üzerinden eşleştirir, aktif olmayan kullanıcıları atar.
 */
export async function resolveMentionUserIds(
  handles: string[]
): Promise<{ id: string; kullanici_ad: string }[]> {
  if (handles.length === 0) return [];

  const { data, error } = await supabase
    .from('uys_kullanicilar')
    .select('id, kullanici_ad')
    .eq('aktif', true)
    .in('kullanici_ad', handles);

  if (error) {
    console.warn('Mention resolve hatası:', error);
    return [];
  }
  return (data ?? []) as { id: string; kullanici_ad: string }[];
}

/**
 * Kullanıcının okunmamış mention sayısı (tüm kanallar).
 */
export async function getUnreadMentionCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('uys_chat_mentions')
    .select('message_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    console.warn('Unread mention count hatası:', error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Bir kanalın mention'larını okundu işaretle.
 * İç akış: kanaldaki mesajları çek → o mesajlara ait user'ın mention'ları → read_at set.
 */
export async function markChannelMentionsRead(
  userId: string,
  channelId: string
): Promise<void> {
  const { data: msgIds, error: err1 } = await supabase
    .from('uys_chat_messages')
    .select('id')
    .eq('channel_id', channelId);

  if (err1) throw err1;
  if (!msgIds || msgIds.length === 0) return;

  const ids = msgIds.map((m: any) => m.id);

  const { error: err2 } = await supabase
    .from('uys_chat_mentions')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
    .in('message_id', ids);

  if (err2) throw err2;
}

/**
 * Yeni mention insert'ini dinler (kendi user_id'me gelenler).
 * Realtime subscription — Topbar'da çağrılacak.
 */
export function subscribeToUserMentions(
  currentUserId: string,
  onNewMention: (mention: { message_id: string; user_id: string }) => void
) {
  const channel = supabase
    .channel(`chat-mentions-${currentUserId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'uys_chat_mentions',
        filter: `user_id=eq.${currentUserId}`,
      },
      (payload) => {
        const m = payload.new as { message_id: string; user_id: string };
        onNewMention(m);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}