import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { MultiCheckDropdown } from '@/components/ui/MultiCheckDropdown';
import { Download } from 'lucide-react';

interface AuditRow {
  id: string;
  zaman: string;
  kullanici_id: string | null;
  kullanici_ad: string | null;
  olay_tipi: string;
  tablo: string | null;
  kayit_id: string | null;
  alan: string | null;
  eski_deger: string | null;
  yeni_deger: string | null;
  aciklama: string | null;
  ek_veri: Record<string, unknown> | null;
}

const PAGE_SIZE = 50;

const OLAY_RENK: Record<string, string> = {
  login:           'bg-blue-100 text-blue-800',
  logout:          'bg-gray-100 text-gray-600',
  wo_olusturuldu:  'bg-green-100 text-green-800',
  wo_tamamlandi:   'bg-emerald-100 text-emerald-800',
  wo_guncellendi:  'bg-yellow-100 text-yellow-800',
  wo_silindi:      'bg-red-100 text-red-700',
  uretim_girildi:  'bg-purple-100 text-purple-800',
  tedarik_geldi:   'bg-teal-100 text-teal-800',
  tedarik_silindi: 'bg-orange-100 text-orange-700',
  stok_duzeltme:   'bg-pink-100 text-pink-800',
};

function olayBadge(tip: string) {
  const cls = OLAY_RENK[tip] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {tip}
    </span>
  );
}

function formatZaman(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function AuditLog() {
  const { can } = useAuth();
  const canView = can('audit_log_goruntule');

  const [rows, setRows]             = useState<AuditRow[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(0);
  const [loading, setLoading]       = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [baslangic, setBaslangic]     = useState('');
  const [bitis, setBitis]             = useState('');
  const [kullaniciAd, setKullaniciAd] = useState('');
  const [secilenOlaylar, setSecilenOlaylar] = useState<Set<string>>(new Set());
  const [tablo, setTablo]             = useState('');

  const [olayTipleri, setOlayTipleri]   = useState<string[]>([]);
  const [kullanicilar, setKullanicilar] = useState<string[]>([]);
  const [tablolar, setTablolar]         = useState<string[]>([]);

  useEffect(() => {
    if (!canView) return;
    supabase.from('uys_audit_log').select('olay_tipi').then(({ data }) => {
      const set = new Set<string>();
      data?.forEach((r: { olay_tipi: string }) => set.add(r.olay_tipi));
      setOlayTipleri([...set].sort());
    });
    supabase.from('uys_audit_log').select('tablo').then(({ data }) => {
      const set = new Set<string>();
      data?.forEach((r: { tablo: string | null }) => { if (r.tablo) set.add(r.tablo); });
      setTablolar([...set].sort());
    });
    supabase.from('uys_audit_log').select('kullanici_ad').not('kullanici_ad', 'is', null).then(({ data }) => {
      const set = new Set<string>();
      data?.forEach((r: { kullanici_ad: string | null }) => { if (r.kullanici_ad) set.add(r.kullanici_ad); });
      setKullanicilar([...set].sort());
    });
  }, [canView]);

  const fetchData = useCallback(async (p: number) => {
    if (!canView) return;
    setLoading(true);
    let q = supabase
      .from('uys_audit_log')
      .select('*', { count: 'exact' })
      .order('zaman', { ascending: false })
      .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1);

    if (baslangic)               q = q.gte('zaman', baslangic + 'T00:00:00');
    if (bitis)                   q = q.lte('zaman', bitis + 'T23:59:59');
    if (kullaniciAd)             q = q.eq('kullanici_ad', kullaniciAd);
    if (secilenOlaylar.size > 0) q = q.in('olay_tipi', [...secilenOlaylar]);
    if (tablo)                   q = q.eq('tablo', tablo);

    const { data, count, error } = await q;
    if (!error && data) {
      setRows(data as AuditRow[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [canView, baslangic, bitis, kullaniciAd, secilenOlaylar, tablo]);

  useEffect(() => { setPage(0); }, [baslangic, bitis, kullaniciAd, secilenOlaylar, tablo]);
  useEffect(() => { fetchData(page); }, [fetchData, page]);

  async function exportExcel() {
    let q = supabase
      .from('uys_audit_log')
      .select('zaman, kullanici_ad, olay_tipi, tablo, kayit_id, alan, eski_deger, yeni_deger, aciklama')
      .order('zaman', { ascending: false })
      .limit(5000);
    if (baslangic)               q = q.gte('zaman', baslangic + 'T00:00:00');
    if (bitis)                   q = q.lte('zaman', bitis + 'T23:59:59');
    if (kullaniciAd)             q = q.eq('kullanici_ad', kullaniciAd);
    if (secilenOlaylar.size > 0) q = q.in('olay_tipi', [...secilenOlaylar]);
    if (tablo)                   q = q.eq('tablo', tablo);
    const { data } = await q;
    if (!data?.length) return;
    import('xlsx').then(XLSX => {
      const exRows = data.map((r: Record<string, unknown>) => ({
        'Zaman':      r.zaman ? new Date(r.zaman as string).toLocaleString('tr-TR') : '',
        'Kullanıcı':  (r.kullanici_ad as string) ?? '',
        'Olay Tipi':  (r.olay_tipi as string) ?? '',
        'Tablo':      (r.tablo as string) ?? '',
        'Kayıt ID':   (r.kayit_id as string) ?? '',
        'Alan':       (r.alan as string) ?? '',
        'Eski Değer': (r.eski_deger as string) ?? '',
        'Yeni Değer': (r.yeni_deger as string) ?? '',
        'Açıklama':   (r.aciklama as string) ?? '',
      }));
      const ws = XLSX.utils.json_to_sheet(exRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
      XLSX.writeFile(wb, `audit_log_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  }

  if (!canView) {
    return (
      <div className="p-8 text-center text-zinc-500">
        Bu sayfayı görüntüleme yetkiniz yok.
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-200">🔍 Audit Log</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">Toplam: {total.toLocaleString('tr-TR')} kayıt</span>
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">
            <Download size={13} /> Excel
          </button>
        </div>
      </div>

      {/* Filtreler */}
      <div className="bg-bg-1 border border-border rounded-lg p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Başlangıç</label>
          <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)}
            className="bg-bg-2 border border-border rounded px-2 py-1 text-xs text-zinc-200" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Bitiş</label>
          <input type="date" value={bitis} onChange={e => setBitis(e.target.value)}
            className="bg-bg-2 border border-border rounded px-2 py-1 text-xs text-zinc-200" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Kullanıcı</label>
          <select value={kullaniciAd} onChange={e => setKullaniciAd(e.target.value)}
            className="bg-bg-2 border border-border rounded px-2 py-1 text-xs text-zinc-200">
            <option value="">Tümü</option>
            {kullanicilar.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <MultiCheckDropdown label="Olay Tipi" options={olayTipleri} selected={secilenOlaylar} onChange={setSecilenOlaylar} />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Tablo</label>
          <select value={tablo} onChange={e => setTablo(e.target.value)}
            className="bg-bg-2 border border-border rounded px-2 py-1 text-xs text-zinc-200">
            <option value="">Tümü</option>
            {tablolar.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {(baslangic || bitis || kullaniciAd || secilenOlaylar.size > 0 || tablo) && (
        <button onClick={() => { setBaslangic(''); setBitis(''); setKullaniciAd(''); setSecilenOlaylar(new Set()); setTablo(''); }}
          className="text-xs text-accent hover:underline">
          ✕ Filtreleri temizle
        </button>
      )}

      {/* Tablo */}
      <div className="bg-bg-1 border border-border rounded-lg overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">Yükleniyor...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">Kayıt bulunamadı.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-bg-2 border-b border-border">
              <tr>
                {['Zaman','Kullanıcı','Olay','Tablo','Kayıt ID','Alan','Eski → Yeni','Açıklama','Detay'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs text-zinc-500 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(row => (
                <>
                  <tr key={row.id} className="hover:bg-bg-2">
                    <td className="px-3 py-2 whitespace-nowrap text-zinc-400 font-mono text-xs">{formatZaman(row.zaman)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-zinc-300">{row.kullanici_ad ?? <span className="text-zinc-600">—</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{olayBadge(row.olay_tipi)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-zinc-500 text-xs font-mono">{row.tablo ?? '—'}</td>
                    <td className="px-3 py-2 text-zinc-500 text-xs font-mono max-w-[120px] truncate">{row.kayit_id ?? '—'}</td>
                    <td className="px-3 py-2 text-zinc-400 text-xs">{row.alan ?? '—'}</td>
                    <td className="px-3 py-2 text-xs max-w-[200px]">
                      {row.eski_deger || row.yeni_deger ? (
                        <span>
                          <span className="text-red/80 line-through">{row.eski_deger ?? ''}</span>
                          {row.eski_deger && row.yeni_deger && <span className="text-zinc-500 mx-1">→</span>}
                          <span className="text-green/80">{row.yeni_deger ?? ''}</span>
                        </span>
                      ) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400 max-w-[200px]">{row.aciklama ?? '—'}</td>
                    <td className="px-3 py-2">
                      {row.ek_veri && (
                        <button onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                          className="text-xs text-accent hover:underline">
                          {expandedId === row.id ? '▲' : '▼ JSON'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === row.id && row.ek_veri && (
                    <tr key={`${row.id}-exp`} className="bg-bg-0">
                      <td colSpan={9} className="px-4 py-3">
                        <pre className="text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(row.ek_veri, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>Sayfa {page + 1} / {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 border border-border rounded disabled:opacity-40 hover:bg-bg-2 text-zinc-300">
              ← Önceki
            </button>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 border border-border rounded disabled:opacity-40 hover:bg-bg-2 text-zinc-300">
              Sonraki →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
