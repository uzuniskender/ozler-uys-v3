// src/features/chat/useChatUser.ts
// Chat sistemi için "current user" hook'u.
// useAuth DB id'sini tutmadığı için burada kullanici_ad veya ad'dan lookup yapılır.

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { ChatUserLite } from './types';

/**
 * Chat için mevcut kullanıcı.
 * useAuth().user.username → uys_kullanicilar.kullanici_ad veya ad ile eşleşen kayıt.
 * Kayıt bulunamazsa null.
 */
export function useChatUser(): {
  chatUser: ChatUserLite | null;
  loading: boolean;
  error: string | null;
} {
  const { user } = useAuth();
  const [chatUser, setChatUser] = useState<ChatUserLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user?.username) {
        setChatUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1) Önce kullanici_ad (login adı) ile dene
        let { data } = await supabase
          .from('uys_kullanicilar')
          .select('id, ad, kullanici_ad, rol')
          .eq('kullanici_ad', user.username)
          .eq('aktif', true)
          .limit(1);

        // 2) Bulunamadıysa ad (tam ad) ile dene — admin/OAuth senaryosu için
        if (!data || data.length === 0) {
          const alt = await supabase
            .from('uys_kullanicilar')
            .select('id, ad, kullanici_ad, rol')
            .eq('ad', user.username)
            .eq('aktif', true)
            .limit(1);
          data = alt.data;
        }

        if (cancelled) return;

        if (data && data.length > 0) {
          setChatUser(data[0] as ChatUserLite);
        } else {
          setChatUser(null);
          setError(`Chat profili bulunamadı (${user.username}). uys_kullanicilar tablosunda kayıt gerek.`);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? 'Lookup hatası');
          setChatUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user?.username]);

  return { chatUser, loading, error };
}
