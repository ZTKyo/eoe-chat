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

$repositoryRoot = Get-RepositoryRoot
$runtimeDirectory = Join-Path $repositoryRoot ".eoe-runtime"
$pidPath = Join-Path $runtimeDirectory "private-beta.pid"
$statePath = Join-Path $runtimeDirectory "private-beta.json"
$stdoutPath = Join-Path $runtimeDirectory "private-beta.stdout.log"
$stderrPath = Join-Path $runtimeDirectory "private-beta.stderr.log"

if (-not (Test-Path -LiteralPath $pidPath) -or -not (Test-Path -LiteralPath $statePath)) {
  Write-Output "Status: stopped"
  Write-Output "Production Mode: not running"
  Write-Output "Logs: $stdoutPath ; $stderrPath"
  exit 0
}

try {
  $state = Get-Content -LiteralPath $statePath -Raw -Encoding utf8 | ConvertFrom-Json
  $privateBetaPid = [int](Get-Content -LiteralPath $pidPath -Raw).Trim()
}
catch {
  Write-Output "Status: stopped"
  Write-Output "Runtime state: stale or unreadable"
  Write-Output "Logs: $stdoutPath ; $stderrPath"
  exit 0
}

$ownedProcess = Get-PrivateBetaProcess -ProcessId $privateBetaPid -RuntimeState $state
if (-not $ownedProcess) {
  Write-Output "Status: stopped"
  Write-Output "Runtime state: stale; the recorded PID is not this project's Production Server"
  Write-Output "PID: $privateBetaPid"
  Write-Output "Logs: $stdoutPath ; $stderrPath"
  exit 0
}

$httpStatus = "unhealthy"
try {
  $homeResponse = Invoke-WebRequest -Uri "http://127.0.0.1:$($state.port)/" -UseBasicParsing -TimeoutSec 5
  $identity = Invoke-RestMethod -Uri "http://127.0.0.1:$($state.port)/api/runtime-identity" -TimeoutSec 5
  if (
    $homeResponse.StatusCode -eq 200 -and
    $identity.executionMode -eq "production" -and
    [int]$identity.liveRequests -eq 0
  ) {
    $httpStatus = "healthy"
  }
}
catch {
  $httpStatus = "unhealthy"
}

Write-Output "Status: running"
Write-Output "PID: $privateBetaPid"
Write-Output "Port: $($state.port)"
Write-Output "Bind Address: $($state.bindAddress)"
Write-Output "Production Mode: $($state.mode)"
Write-Output "HTTP Health: $httpStatus"
Write-Output "Git Commit: $($state.gitCommit)"
Write-Output "Started At: $($state.startedAt)"
Write-Output "Logs: $stdoutPath ; $stderrPath"
