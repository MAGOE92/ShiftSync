# Prueft den Super-Admin-Flow gegen das Live-Gateway:
#   1. Super-Login  2. Kunde anlegen (asSuper)  3. Org lesen (Support-Pfad)
$ErrorActionPreference = "Stop"
$fn = "https://esnqnedjqtslkncttzrr.supabase.co/functions/v1/api"
function Call($payload, $token) {
  $h=@{}; if ($token) { $h["Authorization"]="Bearer $token" }
  $b=[Text.Encoding]::UTF8.GetBytes(($payload|ConvertTo-Json -Compress -Depth 20))
  try { return Invoke-RestMethod -Method Post -Uri $fn -Headers $h -ContentType "application/json; charset=utf-8" -Body $b -TimeoutSec 40 }
  catch { $s=New-Object IO.StreamReader($_.Exception.Response.GetResponseStream()); throw ($s.ReadToEnd()) }
}

Write-Host "1) Super-Login"
$su = Call @{ action="login"; code="ADMIN"; lid="superadmin"; pin="supersecret" }
Write-Host "   super=$($su.super), token-Laenge=$($su.token.Length)"
$tok = $su.token

Write-Host "2) Kunde anlegen als Super (Tarif business gewaehlt)"
$c = Call @{ action="setup"; coName="Super Kunde Test"; coSub="Tankstelle"; weekStdHours=40; name="Inhaber X"; lid="inhaberx"; pin="4444"; plan="business" } $tok
Write-Host "   plan=$($c.org.plan), status=$($c.org.status)  (erwartet: business/active, NICHT trial)"
if ($c.org.plan -ne "business" -or $c.org.status -ne "active") { Write-Host "   [FAIL] Tarif/Status falsch!" } else { Write-Host "   [OK] Tarif wird vom Super uebernommen" }
Write-Host "   emp.role=$($c.emp.role), emp.name=$($c.emp.name)"
$oid = $c.org.id

Write-Host "3) Support-Pfad: get org_{id} als Super"
$d = Call @{ action="get"; key="org_$oid" } $tok
$owner = $d.value.emps | Where-Object { $_.role -eq "owner" }
Write-Host "   emps geladen: $(@($d.value.emps).Count)"
Write-Host "   owner gefunden: $($null -ne $owner) ($($owner.name))"

Write-Host "4) Aufraeumen"
# via Super loeschen
Call @{ action="set"; key="org_$oid"; value=$null } $tok | Out-Null
Write-Host "   Testkunde geloescht"
