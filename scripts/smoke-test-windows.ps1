param(
  [Parameter(Mandatory = $true)]
  [string]$Domain,

  [Parameter(Mandatory = $true)]
  [string]$OriginIp
)

$ErrorActionPreference = "Stop"

function Test-Port {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $result = Test-NetConnection -ComputerName $OriginIp -Port $Port -WarningAction SilentlyContinue
  [PSCustomObject]@{
    Port = $Port
    Reachable = [bool]$result.TcpTestSucceeded
  }
}

Write-Host "Smoke test target domain: $Domain"
Write-Host "Smoke test origin IP: $OriginIp"

$ports = @(22, 80, 443)
$portResults = @()
foreach ($port in $ports) {
  $portResults += Test-Port -Port $port
}

foreach ($entry in $portResults) {
  if ($entry.Reachable) {
    Write-Host "PASS: Port $($entry.Port) reachable on $OriginIp"
  }
  else {
    Write-Host "FAIL: Port $($entry.Port) not reachable on $OriginIp"
  }
}

$allPortsReachable = ($portResults | Where-Object { -not $_.Reachable }).Count -eq 0
if (-not $allPortsReachable) {
  Write-Host "FAIL: Origin network is not fully reachable. Check provider firewall/security group and VPS firewall."
  exit 1
}

$healthUrl = "https://$Domain/api/health"
try {
  $response = Invoke-WebRequest -Uri $healthUrl -Method GET -TimeoutSec 20 -UseBasicParsing
  if ($response.StatusCode -eq 200) {
    Write-Host "PASS: $healthUrl returned 200"
    Write-Host "PASS: Windows smoke test completed"
    exit 0
  }

  Write-Host "FAIL: $healthUrl returned status $($response.StatusCode)"
  exit 1
}
catch {
  Write-Host "FAIL: Request to $healthUrl failed. Check Caddy, docker compose services, and Cloudflare SSL mode."
  exit 1
}

