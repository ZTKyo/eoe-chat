[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Get-RepositoryRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Get-PrivateBetaProcess {
  param(
    [int]$ProcessId,
    [object]$RuntimeState
  )

  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if (-not $process) {
    return $null
  }

  if (
    -not $RuntimeState -or
    -not $RuntimeState.hostProcessStartedAt -or
    -not $RuntimeState.hostExecutablePath
  ) {
    return $null
  }

  try {
    $expectedStartTime = ([datetime]$RuntimeState.hostProcessStartedAt).ToUniversalTime()
    $actualStartTime = $process.StartTime.ToUniversalTime()
    $startTimeMatches = [math]::Abs(($actualStartTime - $expectedStartTime).TotalMilliseconds) -lt 1000
    $pathMatches = [string]$process.Path -ieq [string]$RuntimeState.hostExecutablePath
    if ($process.ProcessName -ieq "powershell" -and $startTimeMatches -and $pathMatches) {
      return $process
    }
  }
  catch {
    return $null
  }
  return $null
}

function Test-PortFree {
  param([int]$TargetPort)
  $activeListeners = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().
    GetActiveTcpListeners()
  return -not [bool]($activeListeners | Where-Object { $_.Port -eq $TargetPort })
}

$repositoryRoot = Get-RepositoryRoot
$runtimeDirectory = Join-Path $repositoryRoot ".eoe-runtime"
$pidPath = Join-Path $runtimeDirectory "private-beta.pid"
$statePath = Join-Path $runtimeDirectory "private-beta.json"
$stopSignalPath = Join-Path $runtimeDirectory "private-beta.stop"

$state = $null
if (Test-Path -LiteralPath $statePath) {
  try {
    $state = Get-Content -LiteralPath $statePath -Raw -Encoding utf8 | ConvertFrom-Json
  }
  catch {
    Write-Warning "Private Beta state JSON is unreadable and will be treated as stale."
  }
}

if (-not (Test-Path -LiteralPath $pidPath)) {
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Write-Output "PRIVATE_TEXT_BETA_STOPPED"
  Write-Output "No running Private Beta PID was recorded."
  exit 0
}

$pidText = (Get-Content -LiteralPath $pidPath -Raw -ErrorAction SilentlyContinue).Trim()
$privateBetaPid = 0
if (-not [int]::TryParse($pidText, [ref]$privateBetaPid)) {
  Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Write-Output "PRIVATE_TEXT_BETA_STOPPED"
  Write-Output "Removed an invalid stale PID file."
  exit 0
}

$ownedProcess = Get-PrivateBetaProcess -ProcessId $privateBetaPid -RuntimeState $state
if (-not $ownedProcess) {
  $unrelatedProcess = Get-Process -Id $privateBetaPid -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Write-Output "PRIVATE_TEXT_BETA_STOPPED"
  if ($unrelatedProcess) {
    Write-Warning "The recorded PID belongs to another process. It was not stopped; stale runtime state was removed."
  }
  else {
    Write-Output "Removed stale runtime state for a process that no longer exists."
  }
  exit 0
}

$port = if ($state -and $state.port) { [int]$state.port } else { 3100 }

New-Item -ItemType File -Path $stopSignalPath -Force | Out-Null
$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
  if (-not (Get-Process -Id $privateBetaPid -ErrorAction SilentlyContinue)) {
    break
  }
  Start-Sleep -Milliseconds 250
}

$portDeadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $portDeadline -and -not (Test-PortFree -TargetPort $port)) {
  Start-Sleep -Milliseconds 250
}

if (
  (Get-Process -Id $privateBetaPid -ErrorAction SilentlyContinue) -or
  -not (Test-PortFree -TargetPort $port)
) {
  Write-Error "PRIVATE_TEXT_BETA_STOP_FAILED: port $port is still occupied. No unrelated process was terminated."
}

Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $stopSignalPath -Force -ErrorAction SilentlyContinue

Write-Output "PRIVATE_TEXT_BETA_STOPPED"
Write-Output "Port $port is released. Runtime logs were preserved."
