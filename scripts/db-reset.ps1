# Setzt die Remote-DB auf den Stand der Migrationsdateien zurück.
# NUR für die leere Erst-Einrichtung gedacht — droppt alle App-Tabellen!
param(
  [string]$Ref = "esnqnedjqtslkncttzrr",
  [string]$Token = $env:SUPABASE_ACCESS_TOKEN
)

$ErrorActionPreference = "Stop"
$uri = "https://api.supabase.com/v1/projects/$Ref/database/query"
$migDir = Join-Path $PSScriptRoot "..\supabase\migrations"

Add-Type -AssemblyName System.Web.Extensions
$ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$ser.MaxJsonLength = [int]::MaxValue

function Invoke-Sql($sql, $label) {
  $payload = $ser.Serialize(@{ query = [string]$sql })
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  try {
    Invoke-RestMethod -Method Post -Uri $uri `
      -Headers @{ Authorization = "Bearer $Token" } `
      -ContentType "application/json; charset=utf-8" `
      -Body $bytes -TimeoutSec 120 | Out-Null
    Write-Host "[OK] $label"
    return $true
  } catch {
    Write-Host "[FEHLER] $label -> $($_.ErrorDetails.Message)"
    return $false
  }
}

$drop = @"
drop table if exists public.wishes cascade;
drop table if exists public.market_offers cascade;
drop table if exists public.clock_entries cascade;
drop table if exists public.notifications cascade;
drop table if exists public.requests cascade;
drop table if exists public.schedules cascade;
drop table if exists public.employees cascade;
drop table if exists public.orgs cascade;
"@
if (-not (Invoke-Sql $drop "drop alte Tabellen")) { exit 1 }

foreach ($f in @("20260101000000_initial_schema.sql", "20260101000001_rls.sql", "20260101000002_realtime.sql")) {
  $sql = Get-Content (Join-Path $migDir $f) -Raw -Encoding UTF8
  if (-not (Invoke-Sql $sql $f)) { exit 1 }
}
Write-Host "DB-RESET KOMPLETT"
