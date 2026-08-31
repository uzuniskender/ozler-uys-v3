import{r as l}from"./supabase-BYHBnSSI.js";var $={VAR:"bg-emerald-400 text-black",KARDES_AYNI_GRUP:"bg-amber-400 text-black",KARDES_FARKLI_GRUP:"bg-orange-500 text-black",YOK:"bg-zinc-700 text-zinc-300",SORULAMADI:"bg-zinc-800 text-zinc-300 border border-dashed border-zinc-500"},d={VAR:"Resim var",KARDES_AYNI_GRUP:"Kardeşte var",KARDES_FARKLI_GRUP:"Kardeşte var (farklı grup)",YOK:"Resim yok",SORULAMADI:"Sorulamadı (kartı yok)"};function k(a){return a==="VAR"?"VAR":a&&a.startsWith("KARDEŞTE VAR (aynı")?"KARDES_AYNI_GRUP":a&&a.startsWith("KARDEŞTE VAR")?"KARDES_FARKLI_GRUP":"YOK"}async function _(a){const n=new Map,t=Array.from(new Set(a.map(r=>(r||"").trim()).filter(Boolean)));if(t.length===0)return n;for(const r of t)n.set(r,{kod:r,ad:null,durum:"SORULAMADI",kardesKod:null,etiket:d.SORULAMADI,analiz:"SORULAMADI",analizKardes:null});for(let r=0;r<t.length;r+=200){const{data:i,error:o}=await l.from("uys_teknik_resim_durum_v").select("kod, ad, ortak_alan_durum, ortak_alan_kardes, analiz_durum, analiz_kardes").in("kod",t.slice(r,r+200));if(o)throw o;for(const e of i??[]){const s=String(e.kod),u=k(e.ortak_alan_durum==null?null:String(e.ortak_alan_durum));n.set(s,{kod:s,ad:e.ad==null?null:String(e.ad),durum:u,kardesKod:e.ortak_alan_kardes==null?null:String(e.ortak_alan_kardes),etiket:d[u],analiz:k(e.analiz_durum==null?null:String(e.analiz_durum)),analizKardes:e.analiz_kardes==null?null:String(e.analiz_kardes)})}}return n}var m="O:\\ARGE\\TEKNIK_RESIM";function y(a,n=m,t=["pdf","dxf","dwg","stp","step"]){const r=Array.from(new Set(a.map(e=>(e||"").trim()).filter(Boolean))),i=r.map(e=>'"'+e+'"').join(","),o=(t.length?t:["pdf"]).map(e=>"*."+e.replace(/^\./,"")).join(",");return`# UYS — Teknik Resim Toplayici (${r.length} kod)
# Bulunanlari masaustune kopyalar + zipler, bulunamayanlari listeler.
# Kardes kurali: kod bulunamazsa ilk 8 hane sabit, son hane serbest aranir (_KARDES).

$kaynak = "${n}"
$kodlar = @(${i})

$hedef = Join-Path ([Environment]::GetFolderPath("Desktop")) "teknik_resim_$(Get-Date -Format yyyyMMdd_HHmm)"
New-Item -ItemType Directory -Path $hedef -Force | Out-Null

Write-Host "Taraniyor: $kaynak ..." -ForegroundColor Cyan
$tumu = Get-ChildItem -Path $kaynak -Recurse -File -Include ${o} -ErrorAction SilentlyContinue
Write-Host "$($tumu.Count) dosya tarandi (${o})."

$eksik = @()
foreach ($kod in $kodlar) {
    $bul = $tumu | Where-Object { $_.Name -like "*$kod*" }
    $etiket = $kod
    if (-not $bul -and $kod.Length -ge 9) {
        $taban = $kod.Substring(0,8)
        $bul = $tumu | Where-Object { $_.Name -match "$taban[0-9]" }
        if ($bul) { $etiket = ($kod + "_KARDES") }
    }
    if ($bul) {
        $kl = Join-Path $hedef $etiket
        New-Item -ItemType Directory -Path $kl -Force | Out-Null
        $bul | ForEach-Object { Copy-Item $_.FullName -Destination (Join-Path $kl $_.Name) -Force }
        Write-Host ("{0,-16} {1} dosya" -f $etiket, $bul.Count) -ForegroundColor Green
    } else {
        $eksik += $kod
        Write-Host ("{0,-16} BULUNAMADI" -f $kod) -ForegroundColor Yellow
    }
}

if (Get-ChildItem $hedef -ErrorAction SilentlyContinue) {
    Compress-Archive -Path (Join-Path $hedef "*") -DestinationPath ($hedef + ".zip") -Force
    Remove-Item $hedef -Recurse -Force
    Write-Host "Hazir: $hedef.zip" -ForegroundColor Cyan
} else {
    Remove-Item $hedef -Recurse -Force
    Write-Host "Hicbir dosya bulunamadi." -ForegroundColor Red
}

if ($eksik.Count -gt 0) {
    $eksikDosya = ($hedef + "_BULUNAMAYANLAR.txt")
    $eksik | Set-Content -Path $eksikDosya -Encoding UTF8
    Write-Host "BULUNAMAYANLAR ($($eksik.Count)):" -ForegroundColor Yellow
    $eksik | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    Write-Host "Liste: $eksikDosya" -ForegroundColor Yellow
}
`}async function A(){const{data:a,error:n}=await l.from("uys_teknik_resim_envanter_tarama").select("ts").order("ts",{ascending:!1}).limit(1);if(n||!a||a.length===0)return{tarih:null,yasGun:null};const t=String(a[0].ts);return{tarih:t,yasGun:Math.round((Date.now()-new Date(t).getTime())/864e5)}}async function f(a,n){const t=a.map(e=>e.trim()).filter(e=>/\.pdf$/i.test(e));if(t.length===0)throw new Error("Listede .pdf ile biten satır yok");const{data:r,error:i}=await l.rpc("uys_teknik_resim_envanter_yaz",{p_dosyalar:t,p_kullanici:n??null});if(i)throw i;const o=Array.isArray(r)?r[0]:r;return{dosya:Number(o?.r_dosya??0),kod:Number(o?.r_kod??0),yeni:Number(o?.r_yeni??0),kaybolan:Number(o?.r_kaybolan??0)}}function h(a=m){return`# UYS — Ortak alan envanteri. Sadece DOSYA ADLARINI panoya kopyalar (dosya kopyalanmaz).
Get-ChildItem "${a}" -Recurse -File -Include *.pdf |
  Select-Object -ExpandProperty Name | Set-Clipboard
Write-Host "Dosya adlari panoya kopyalandi. UYS > Teknik Resim Toplayici sayfasina yapistirin." -ForegroundColor Cyan
`}export{f as a,h as i,$ as n,y as o,A as r,_ as s,d as t};
