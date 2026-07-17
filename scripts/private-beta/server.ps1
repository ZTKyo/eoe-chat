[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$BindAddress,

  [Parameter(Mandatory)]
  [ValidateRange(1, 65535)]
  [int]$Port,

  [Parameter(Mandatory)]
  [string]$RunId,

  [Parameter(Mandatory)]
  [string]$StartedAt
)

$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runtimeDirectory = Join-Path $repositoryRoot ".eoe-runtime"
$stdoutPath = Join-Path $runtimeDirectory "private-beta.stdout.log"
$stderrPath = Join-Path $runtimeDirectory "private-beta.stderr.log"
$stopSignalPath = Join-Path $runtimeDirectory "private-beta.stop"
$nextCli = Join-Path $repositoryRoot "node_modules\next\dist\bin\next"
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source

$env:NODE_ENV = "production"
$env:EOE_EXECUTION_MODE = "production"
$env:EOE_ALLOW_LIVE_PROVIDER = "false"
$env:USE_MOCK_PROVIDER = "true"
$env:EOE_ENABLE_IMAGE_INPUT = "false"
$env:EOE_DEVELOPER_MODE = "false"
$env:EOE_SERVER_PORT = [string]$Port
$env:EOE_SERVER_RUN_ID = $RunId
$env:EOE_SERVER_STARTED_AT = $StartedAt

Push-Location $repositoryRoot
try {
  $arguments = @("`"$nextCli`"", "start", "-H", $BindAddress, "-p", [string]$Port)
  $serverProcess = Start-Process `
    -FilePath $nodeExe `
    -ArgumentList $arguments `
    -WorkingDirectory $repositoryRoot `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -WindowStyle Hidden `
    -PassThru

  while (-not $serverProcess.HasExited) {
    if (Test-Path -LiteralPath $stopSignalPath -PathType Leaf) {
      Stop-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue
      if (-not $serverProcess.WaitForExit(5000)) {
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
        [void]$serverProcess.WaitForExit(5000)
      }
      break
    }
    Start-Sleep -Milliseconds 250
  }

  if ($serverProcess.HasExited) {
    exit $serverProcess.ExitCode
  }
  exit 1
}
catch {
  $_ | Out-String | Add-Content -LiteralPath $stderrPath -Encoding utf8
  exit 1
}
finally {
  Remove-Item -LiteralPath $stopSignalPath -Force -ErrorAction SilentlyContinue
  Pop-Location
}
