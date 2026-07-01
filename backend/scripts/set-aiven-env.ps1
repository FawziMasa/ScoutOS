param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseUrl,

    [string]$FrontendUrl = "http://localhost:5173"
)

$envPath = Join-Path $PSScriptRoot "..\.env"
$content = @"
PORT=4000
FRONTEND_URL=$FrontendUrl
DATABASE_URL=$DatabaseUrl
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
"@

Set-Content -LiteralPath $envPath -Value $content -Encoding UTF8
Write-Host "ScoutOS backend .env updated:" $envPath
Write-Host "Next run: npm.cmd run migrate"
