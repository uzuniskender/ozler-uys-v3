-- sql/uys_chat_v1.sql
-- OzlerMsg v1 - Kurumsal Mesajlasma

CREATE TABLE IF NOT EXISTS public.uys_chat_channels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text,
  type        text NOT NULL CHECK (type IN ('dm','group')),
  description text,
  created_by  text,
  archived_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.uys_chat_members (
  channel_id   uuid NOT NULL,
  user_id      text NOT NULL,
  role         text DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  muted        boolean DEFAULT false,
  last_read_at timestamptz,
  joined_at    timestamptz DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.uys_chat_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  uuid NOT NULL,
  user_id     text NOT NULL,
  body        text NOT NULL,
  reply_to_id uuid,
  edited_at   timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.uys_chat_mentions (
  message_id uuid NOT NULL,
  user_id    text NOT NULL,
  read_at    timestamptz,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.uys_chat_reactions (
  message_id uuid NOT NULL,
  user_id    text NOT NULL,
  emoji      text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.uys_chat_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   uuid NOT NULL,
  storage_path text NOT NULL,
  mime_type    text,
  file_name    text,
  size_bytes   bigint,
  created_at   timestamptz DEFAULT now()
);
