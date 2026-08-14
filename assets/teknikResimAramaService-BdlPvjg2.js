import{r as l}from"./supabase-BYHBnSSI.js";var $={VAR:"bg-emerald-400 text-black",KARDES_AYNI_GRUP:"bg-amber-400 text-black",KARDES_FARKLI_GRUP:"bg-orange-500 text-black",YOK:"bg-zinc-700 text-zinc-300"},d={VAR:"Resim var",KARDES_AYNI_GRUP:"Kardeşte var",KARDES_FARKLI_GRUP:"Kardeşte var (farklı grup)",YOK:"Resim yok"};function k(e){return e==="VAR"?"VAR":e&&e.startsWith("KARDEŞTE VAR (aynı")?"KARDES_AYNI_GRUP":e&&e.startsWith("KARDEŞTE VAR")?"KARDES_FARKLI_GRUP":"YOK"}async function _(e){const n=new Map,t=Array.from(new Set(e.map(a=>(a||"").trim()).filter(Boolean)));if(t.length===0)return n;for(const a of t)n.set(a,{kod:a,ad:null,durum:"YOK",kardesKod:null,etiket:d.YOK,analiz:"YOK",analizKardes:null});for(let a=0;a<t.length;a+=200){const{data:o,error:i}=await l.from("uys_teknik_resim_durum_v").select("kod, ad, ortak_alan_durum, ortak_alan_kardes, analiz_durum, analiz_kardes").in("kod",t.slice(a,a+200));if(i)throw i;for(const r of o??[]){const s=String(r.kod),u=k(r.ortak_alan_durum==null?null:String(r.ortak_alan_durum));n.set(s,{kod:s,ad:r.ad==null?null:String(r.ad),durum:u,kardesKod:r.ortak_alan_kardes==null?null:String(r.ortak_alan_kardes),etiket:d[u],analiz:k(r.analiz_durum==null?null:String(r.analiz_durum)),analizKardes:r.analiz_kardes==null?null:String(r.analiz_kardes)})}}return n}var m="O:\\ARGE\\TEKNIK_RESIM";function y(e,n=m){const t=Array.from(new Set(e.map(o=>(o||"").trim()).filter(Boolean))),a=t.map(o=>'"'+o+'"').join(",");return`# UYS — Teknik Resim Toplayici (${t.length} kod)
# Bulunanlari masaustune kopyalar + zipler, bulunamayanlari listeler.
# Kardes kurali: kod bulunamazsa ilk 8 hane sabit, son hane serbest aranir (_KARDES).

$kaynak = "${n}"
$kodlar = @(${a})

$hedef = Join-Path ([Environment]::GetFolderPath("Desktop")) "teknik_resim_$(Get-Date -Format yyyyMMdd_HHmm)"
New-Item -ItemType Directory -Path $hedef -Force | Out-Null

Write-Host "Taraniyor: $kaynak ..." -ForegroundColor Cyan
$tumu = Get-ChildItem -Path $kaynak -Recurse -File -Include *.pdf -ErrorAction SilentlyContinue
Write-Host "$($tumu.Count) pdf tarandi."

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
`}async function f(){const{data:e,error:n}=await l.from("uys_teknik_resim_envanter_tarama").select("ts").order("ts",{ascending:!1}).limit(1);if(n||!e||e.length===0)return{tarih:null,yasGun:null};const t=String(e[0].ts);return{tarih:t,yasGun:Math.round((Date.now()-new Date(t).getTime())/864e5)}}async function h(e,n){const t=e.map(r=>r.trim()).filter(r=>/\.pdf$/i.test(r));if(t.length===0)throw new Error("Listede .pdf ile biten satır yok");const{data:a,error:o}=await l.rpc("uys_teknik_resim_envanter_yaz",{p_dosyalar:t,p_kullanici:n??null});if(o)throw o;const i=Array.isArray(a)?a[0]:a;return{dosya:Number(i?.r_dosya??0),kod:Number(i?.r_kod??0),yeni:Number(i?.r_yeni??0),kaybolan:Number(i?.r_kaybolan??0)}}function A(e=m){return`# UYS — Ortak alan envanteri. Sadece DOSYA ADLARINI panoya kopyalar (dosya kopyalanmaz).
Get-ChildItem "${e}" -Recurse -File -Include *.pdf |
  Select-Object -ExpandProperty Name | Set-Clipboard
Write-Host "Dosya adlari panoya kopyalandi. UYS > Teknik Resim Toplayici sayfasina yapistirin." -ForegroundColor Cyan
`}export{h as a,A as i,$ as n,y as o,f as r,_ as s,d as t};
