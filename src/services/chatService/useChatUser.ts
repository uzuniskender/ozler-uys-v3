// src/features/chat/useChatUser.ts
// Chat sistemi için "current user" hook'u.
// Öncelik sırası:
//  1) user.dbId varsa → direkt id ile lookup (en sağlam, string eşleştirmesi yok)
//  2) user.username → kullanici_ad ile lookup
//  3) user.username → ad ile lookup (admin/OAuth fallback)

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { ChatUserLite } from './types';

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
      if (!user?.username && !user?.dbId) {
        setChatUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let data: any[] | null = null;

        // 1) user.dbId varsa direkt id ile — en sağlam yol
        if (user?.dbId) {
          const byId = await supabase
            .from('uys_kullanicilar')
            .select('id, ad, kullanici_ad, rol')
            .eq('id', user.dbId)
            .eq('aktif', true)
            .limit(1);
          data = byId.data;
        }

        // 2) Fallback: kullanici_ad (login adı)
        if ((!data || data.length === 0) && user?.username) {
          const byKullaniciAd = await supabase
            .from('uys_kullanicilar')
            .select('id, ad, kullanici_ad, rol')
            .eq('kullanici_ad', user.username)
            .eq('aktif', true)
            .limit(1);
          data = byKullaniciAd.data;
        }

        // 3) Fallback: ad (tam ad — admin/OAuth senaryosu için)
        if ((!data || data.length === 0) && user?.username) {
          const byAd = await supabase
            .from('uys_kullanicilar')
            .select('id, ad, kullanici_ad, rol')
            .eq('ad', user.username)
            .eq('aktif', true)
            .limit(1);
          data = byAd.data;
        }

        if (cancelled) return;

        if (data && data.length > 0) {
          setChatUser(data[0] as ChatUserLite);
        } else {
          setChatUser(null);
          setError(
            `Chat profili bulunamadı (username=${user?.username ?? '-'}, dbId=${user?.dbId ?? '-'}). ` +
            `uys_kullanicilar tablosunda aktif kayıt gerek.`
          );
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
  }, [user?.username, user?.dbId]);

  return { chatUser, loading, error };
}