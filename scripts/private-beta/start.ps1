[CmdletBinding()]
param(
  [ValidateRange(1, 65535)]
  [int]$Port = 3100,
  [switch]$Lan,
  [switch]$Rebuild
)

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

function Remove-StaleRuntimeState {
  param(
    [string]$PidPath,
    [string]$StatePath
  )
  Remove-Item -LiteralPath $PidPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
}

$repositoryRoot = Get-RepositoryRoot
$runtimeDirectory = Join-Path $repositoryRoot ".eoe-runtime"
$pidPath = Join-Path $runtimeDirectory "private-beta.pid"
$statePath = Join-Path $runtimeDirectory "private-beta.json"
$stdoutPath = Join-Path $runtimeDirectory "private-beta.stdout.log"
$stderrPath = Join-Path $runtimeDirectory "private-beta.stderr.log"
$stopSignalPath = Join-Path $runtimeDirectory "private-beta.stop"
$envPath = Join-Path $repositoryRoot ".env.local"
$buildIdPath = Join-Path $repositoryRoot ".next\BUILD_ID"
$nextServerDirectory = Join-Path $repositoryRoot ".next\server"
$nextCli = Join-Path $repositoryRoot "node_modules\next\dist\bin\next"
$serverScript = Join-Path $PSScriptRoot "server.ps1"

if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
  Write-Error "PRIVATE_TEXT_BETA_START_BLOCKED: .env.local is missing."
}

$requiredVariableNames = @(
  "GLM_API_KEY",
  "DEEPSEEK_API_KEY"
)
$definedVariableNames = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($line in Get-Content -LiteralPath $envPath -Encoding utf8) {
  if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=") {
    [void]$definedVariableNames.Add($Matches[1])
  }
}
$missingVariableNames = @($requiredVariableNames | Where-Object { -not $definedVariableNames.Contains($_) })
if ($missingVariableNames.Count -gt 0) {
  Write-Error "PRIVATE_TEXT_BETA_START_BLOCKED: required variable names are missing: $($missingVariableNames -join ', ')."
}

New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null

if (Test-Path -LiteralPath $pidPath) {
  $oldPidText = (Get-Content -LiteralPath $pidPath -Raw -ErrorAction SilentlyContinue).Trim()
  $oldPid = 0
  $oldState = $null
  if (Test-Path -LiteralPath $statePath) {
    try {
      $oldState = Get-Content -LiteralPath $statePath -Raw -Encoding utf8 | ConvertFrom-Json
    }
    catch {
      $oldState = $null
    }
  }
  if ([int]::TryParse($oldPidText, [ref]$oldPid)) {
    $ownedProcess = Get-PrivateBetaProcess -ProcessId $oldPid -RuntimeState $oldState
    if ($ownedProcess) {
      Write-Error "PRIVATE_TEXT_BETA_ALREADY_RUNNING: PID=$oldPid. Use Stop-Private-Beta.cmd first."
    }
  }
  Remove-StaleRuntimeState -PidPath $pidPath -StatePath $statePath
  Write-Output "Removed stale Private Beta runtime state."
}

if (-not (Test-PortFree -TargetPort $Port)) {
  Write-Error "PRIVATE_TEXT_BETA_START_BLOCKED: port $Port is already in use."
}

$buildValid =
  (Test-Path -LiteralPath $buildIdPath -PathType Leaf) -and
  (Test-Path -LiteralPath $nextServerDirectory -PathType Container) -and
  ((Get-Content -LiteralPath $buildIdPath -Raw -ErrorAction SilentlyContinue).Trim().Length -gt 0)

if ($Rebuild -or -not $buildValid) {
  Write-Output "Preparing Production Build..."
  Push-Location $repositoryRoot
  try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build failed with exit code $LASTEXITCODE."
    }
  }
  finally {
    Pop-Location
  }
}
else {
  Write-Output "Using existing Production Build."
}

if (
  -not (Test-Path -LiteralPath $nextCli -PathType Leaf) -or
  -not (Test-Path -LiteralPath $serverScript -PathType Leaf)
) {
  Write-Error "PRIVATE_TEXT_BETA_START_BLOCKED: Next.js runtime is missing. Run npm install."
}

$bindAddress = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }
if ($Lan) {
  Write-Warning "LAN mode allows devices on the same local network to reach this service."
  Write-Warning "Do not use LAN mode on public Wi-Fi."
  Write-Warning "This script does not modify Windows Firewall, open a public port, or configure router port forwarding."
}

$startedAt = (Get-Date).ToUniversalTime().ToString("o")
$runId = "private-beta-$((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ'))"
$gitCommit = (& git -C $repositoryRoot rev-parse --short HEAD).Trim()

Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $stopSignalPath -Force -ErrorAction SilentlyContinue

$effectivePath = $env:Path
[Environment]::SetEnvironmentVariable("PATH", $null, "Process")
[Environment]::SetEnvironmentVariable("Path", $null, "Process")
[Environment]::SetEnvironmentVariable("Path", $effectivePath, "Process")

$argumentList = @(
  "-NoLogo",
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$serverScript`"",
  "-BindAddress", "`"$bindAddress`"",
  "-Port", [string]$Port,
  "-RunId", "`"$runId`"",
  "-StartedAt", "`"$startedAt`""
)
$process = Start-Process `
  -FilePath "powershell.exe" `
  -ArgumentList $argumentList `
  -WorkingDirectory $repositoryRoot `
  -WindowStyle Hidden `
  -PassThru
$processId = [int]$process.Id
$hostProcessStartedAt = $process.StartTime.ToUniversalTime().ToString("o")
$hostExecutablePath = [string]$process.Path
Set-Content -LiteralPath $pidPath -Value ([string]$processId) -Encoding ascii
$runtimeState = [pscustomobject]@{
  pid = $processId
  port = $Port
  bindAddress = $bindAddress
  startedAt = $startedAt
  mode = "production"
  lanEnabled = [bool]$Lan
  gitCommit = $gitCommit
  runId = $runId
  hostProcessStartedAt = $hostProcessStartedAt
  hostExecutablePath = $hostExecutablePath
}
$runtimeState | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8

$deadline = (Get-Date).AddSeconds(120)
$healthy = $false
$lastHealthError = ""
while ((Get-Date) -lt $deadline) {
  if ($process.HasExited) {
    $lastHealthError = "Production Server exited with code $($process.ExitCode)."
    break
  }
  try {
    $homeResponse = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 3
    $identity = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/runtime-identity" -TimeoutSec 3
    if (
      $homeResponse.StatusCode -eq 200 -and
      $identity.executionMode -eq "production" -and
      [int]$identity.port -eq $Port -and
      [int]$identity.liveRequests -eq 0
    ) {
      $healthy = $true
      break
    }
    $lastHealthError = "Production identity check did not match."
  }
  catch {
    $lastHealthError = $_.Exception.Message
  }
  Start-Sleep -Milliseconds 500
}

if (-not $healthy) {
  $ownedProcess = Get-PrivateBetaProcess -ProcessId $process.Id -RuntimeState $runtimeState
  if ($ownedProcess) {
    New-Item -ItemType File -Path $stopSignalPath -Force | Out-Null
    [void]$process.WaitForExit(10000)
  }
  Remove-StaleRuntimeState -PidPath $pidPath -StatePath $statePath
  Write-Error "PRIVATE_TEXT_BETA_START_FAILED: $lastHealthError See the runtime logs."
}

$localUrl = "http://127.0.0.1:$Port"
Write-Output "PRIVATE_TEXT_BETA_RUNNING"
Write-Output "Local URL: $localUrl"
if ($Lan) {
  $lanAddress = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -ne "127.0.0.1" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.AddressState -eq "Preferred"
    } |
    Select-Object -First 1 -ExpandProperty IPAddress
  if ($lanAddress) {
    Write-Output "LAN URL: http://${lanAddress}:$Port"
  }
  else {
    Write-Output "LAN URL: unavailable; check the trusted local network adapter."
  }
}
Write-Output "PID: $processId"
Write-Output "Mode: Production"
Write-Output "Bind Address: $bindAddress"
Write-Output "Logs: $stdoutPath ; $stderrPath"
Write-Output "Stop: .\Stop-Private-Beta.cmd"
