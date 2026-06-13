# End-to-End-Test des API-Gateways gegen die Live-Funktion.
$ErrorActionPreference = "Stop"
$fn = "https://esnqnedjqtslkncttzrr.supabase.co/functions/v1/api"
$fails = 0

function Call($payload, $token) {
  $headers = @{}
  if ($token) { $headers["Authorization"] = "Bearer $token" }
  $json = $payload | ConvertTo-Json -Compress -Depth 20
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  try {
    return Invoke-RestMethod -Method Post -Uri $fn -Headers $headers `
      -ContentType "application/json; charset=utf-8" -Body $bytes -TimeoutSec 40
  } catch {
    # Fehler-Body als UTF-8 aus dem Response-Stream lesen (ErrorDetails ist in PS 5.1 unzuverlaessig)
    $body = ""
    if ($_.Exception.Response) {
      try {
        $stream = $_.Exception.Response.GetResponseStream()
        $stream.Position = 0
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd()
      } catch {}
    }
    if (-not $body) { $body = $_.ErrorDetails.Message }
    $emsg = $body
    try { $emsg = ($body | ConvertFrom-Json).error } catch {}
    throw "$emsg"
  }
}
function Check($cond, $label) {
  if ($cond) { Write-Host "  [OK] $label" }
  else { Write-Host "  [FAIL] $label"; $script:fails++ }
}

# Eindeutiger Name pro Lauf (vermeidet Code-Kollision)
$suffix = (Get-Date).Ticks.ToString().Substring(10)
$coName = "GW Test $suffix"

Write-Host "1) setup (Betrieb anlegen)"
$s = Call @{ action="setup"; coName=$coName; coSub="Tankstelle"; weekStdHours=40; name="Chef"; lid="chef"; pin="4711" }
Check ($s.token.Length -gt 20) "Token erhalten"
Check ($s.org.code.Length -eq 5) "Betriebs-ID: $($s.org.code)"
Check ($null -eq $s.emp.pin) "emp ohne PIN ausgeliefert"
Check ($s.emp.role -eq "owner") "Inhaber-Rolle"
Check ($s.data.emps.Count -eq 1) "1 Mitarbeiter in data"
$tok = $s.token; $oid = $s.org.id; $code = $s.org.code

Write-Host "2) login (frisch, mit Leerzeichen/Caps)"
$l = Call @{ action="login"; code=" $($code.ToLower()) "; lid=" CHEF "; pin=" 4711 " }
Check ($l.token.Length -gt 20) "Login-Token (trotz Whitespace/Caps)"
Check ($l.emp.role -eq "owner") "als Inhaber eingeloggt"
$tok = $l.token

Write-Host "3) login mit falscher PIN"
try { Call @{ action="login"; code=$code; lid="chef"; pin="0000" }; Check $false "haette fehlschlagen muessen" }
catch { Check ($_.Exception.Message -match "PIN falsch") "praezise PIN-Meldung: $($_.Exception.Message)" }

Write-Host "4) login mit unbekannter Login-ID"
try { Call @{ action="login"; code=$code; lid="niemand"; pin="4711" }; Check $false "haette fehlschlagen muessen" }
catch { Check ($_.Exception.Message -match "existiert in diesem Betrieb nicht") "praezise ID-Meldung" }

Write-Host "5) get orgs (mit Token)"
$go = Call @{ action="get"; key="orgs" } $tok
Check (@($go.value).Count -ge 1) "orgs-Liste geladen (@($go.value).Count)"
Check (@($go.value | Where-Object { $_.id -eq $oid }).Count -eq 1) "eigener Betrieb enthalten"

Write-Host "6) get ohne Token -> 401"
try { Call @{ action="get"; key="orgs" }; Check $false "haette 401 sein muessen" }
catch { Check ($_.Exception.Message -match "Sitzung abgelaufen|neu anmelden") "ohne Token abgewiesen" }

Write-Host "7) set org_{id}: Mitarbeiter anlegen (Klartext-PIN -> Hash)"
$newEmp = @{ id="emp_test_001"; name="David Koch"; lid="David.Koch "; pin="5678 "; role="staff"; workPct=100; pref="any"; inPlan=$true; notes=""; linkedOrgs=@() }
$owner  = @{ id=$s.emp.id; name="Chef"; lid="chef"; role="owner"; workPct=100; pref="any"; inPlan=$false; notes=""; linkedOrgs=@() }
$setData = @{ emps=@($owner,$newEmp); wishes=@{}; scheds=@{}; reqs=@(); notifs=@(); clock=@{}; market=@() }
Call @{ action="set"; key="org_$oid"; value=$setData } $tok | Out-Null
Write-Host "  [OK] set ausgefuehrt"

Write-Host "8) get org_{id}: zurueckgelesen"
$gd = Call @{ action="get"; key="org_$oid" } $tok
$david = $gd.value.emps | Where-Object { $_.name -eq "David Koch" }
Check ($null -ne $david) "David gespeichert"
Check ($david.lid -eq "david.koch") "lid normalisiert: $($david.lid)"
Check ($null -eq $david.pin) "PIN nicht ausgeliefert"
Check (@($gd.value.emps).Count -eq 2) "2 Mitarbeiter"

Write-Host "9) login als David mit getrimmter PIN '5678'"
$ld = Call @{ action="login"; code=$code; lid="david.koch"; pin="5678" }
Check ($ld.emp.name -eq "David Koch") "David-Login erfolgreich (PIN getrimmt+gehasht)"

Write-Host "10) chpin (David aendert PIN)"
$dtok = $ld.token
Call @{ action="chpin"; cur="5678"; nw="9999" } $dtok | Out-Null
$ld2 = Call @{ action="login"; code=$code; lid="david.koch"; pin="9999" }
Check ($ld2.emp.name -eq "David Koch") "Login mit neuer PIN 9999"
try { Call @{ action="login"; code=$code; lid="david.koch"; pin="5678" }; Check $false "alte PIN haette nicht gehen duerfen" }
catch { Check ($_.Exception.Message -match "PIN falsch") "alte PIN abgelehnt" }

Write-Host "11) Reconcile: David wieder entfernen via set"
Call @{ action="set"; key="org_$oid"; value=@{ emps=@($owner); wishes=@{}; scheds=@{}; reqs=@(); notifs=@(); clock=@{}; market=@() } } $tok | Out-Null
$gd2 = Call @{ action="get"; key="org_$oid" } $tok
Check (@($gd2.value.emps).Count -eq 1) "David entfernt (Reconcile-Delete)"

Write-Host "12) Mandantentrennung: David-Token (existiert nicht mehr) kann nicht auf anderen Betrieb"
# Zweiter Betrieb
$s2 = Call @{ action="setup"; coName="GW Other $suffix"; coSub="x"; weekStdHours=40; name="Andi"; lid="andi"; pin="2222" }
try { Call @{ action="get"; key="org_$($s2.org.id)" } $tok; Check $false "Querzugriff haette scheitern muessen" }
catch { Check ($_.Exception.Message -match "Kein Zugriff") "Querzugriff auf fremden Betrieb blockiert" }

Write-Host ""
if ($fails -eq 0) { Write-Host "ALLE GATEWAY-TESTS BESTANDEN" }
else { Write-Host "$fails TEST(S) FEHLGESCHLAGEN"; exit 1 }

# IDs der Testbetriebe fuer spaeteres Aufraeumen ausgeben
Write-Host "CLEANUP_IDS=$oid,$($s2.org.id)"
