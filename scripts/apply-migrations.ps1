# Wendet die Supabase-Migrationen über die Management-API an.
# Body wird explizit als UTF-8 gesendet (sonst zerlegen Unicode-Kommentare das JSON).
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
    $r = Invoke-RestMethod -Method Post -Uri $uri `
      -Headers @{ Authorization = "Bearer $Token" } `
      -ContentType "application/json; charset=utf-8" `
      -Body $bytes -TimeoutSec 90
    Write-Host "[OK] $label"
    return $true
  } catch {
    $msg = $_.ErrorDetails.Message
    if (-not $msg -and $_.Exception.Response) {
      $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $msg = $sr.ReadToEnd()
    }
    Write-Host "[FEHLER] $label -> $msg"
    return $false
  }
}

$files = @(
  "20260101000000_initial_schema.sql",
  "20260101000001_rls.sql",
  "20260101000002_realtime.sql"
)

foreach ($f in $files) {
  $path = Join-Path $migDir $f
  $sql = Get-Content $path -Raw -Encoding UTF8
  $ok = Invoke-Sql $sql $f
  if (-not $ok) { Write-Host "Abbruch bei $f"; exit 1 }
}
Write-Host "ALLE MIGRATIONEN ANGEWENDET"
