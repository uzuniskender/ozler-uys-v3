import{r as k}from"./supabase-BYHBnSSI.js";var c={VAR:"bg-emerald-400 text-black",KARDES_AYNI_GRUP:"bg-amber-400 text-black",KARDES_FARKLI_GRUP:"bg-orange-500 text-black",YOK:"bg-zinc-700 text-zinc-300"},u={VAR:"Resim var",KARDES_AYNI_GRUP:"Kardeşte var",KARDES_FARKLI_GRUP:"Kardeşte var (farklı grup)",YOK:"Resim yok"};function d(t){return t==="VAR"?"VAR":t&&t.startsWith("KARDEŞTE VAR (aynı")?"KARDES_AYNI_GRUP":t&&t.startsWith("KARDEŞTE VAR")?"KARDES_FARKLI_GRUP":"YOK"}async function A(t){const a=new Map,r=Array.from(new Set(t.map(e=>(e||"").trim()).filter(Boolean)));if(r.length===0)return a;for(const e of r)a.set(e,{kod:e,ad:null,durum:"YOK",kardesKod:null,etiket:u.YOK});for(let e=0;e<r.length;e+=200){const{data:n,error:i}=await k.from("uys_teknik_resim_kardes_v").select("kod, ad, durum, kardes_kod").in("kod",r.slice(e,e+200));if(i)throw i;for(const o of n??[]){const l=String(o.kod),s=d(o.durum==null?null:String(o.durum));a.set(l,{kod:l,ad:o.ad==null?null:String(o.ad),durum:s,kardesKod:o.kardes_kod==null?null:String(o.kardes_kod),etiket:u[s]})}}return a}var $="O:\\ARGE\\TEKNIK_RESIM";function R(t,a=$){const r=Array.from(new Set(t.map(n=>(n||"").trim()).filter(Boolean))),e=r.map(n=>'"'+n+'"').join(",");return`# UYS — Teknik Resim Toplayici (${r.length} kod)
# Bulunanlari masaustune kopyalar + zipler, bulunamayanlari listeler.
# Kardes kurali: kod bulunamazsa ilk 8 hane sabit, son hane serbest aranir (_KARDES).

$kaynak = "${a}"
$kodlar = @(${e})

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
`}export{A as i,c as n,R as r,u as t};
