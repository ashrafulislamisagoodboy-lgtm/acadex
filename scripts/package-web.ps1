$ErrorActionPreference = 'Stop'

$project = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
$folderName = "Acadex-Web-$($project.version)"
$releaseRoot = Join-Path (Get-Location) 'release'
$packageFolder = Join-Path $releaseRoot $folderName
$archive = Join-Path $releaseRoot "$folderName.zip"

New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
if (Test-Path -LiteralPath $packageFolder) {
  Remove-Item -LiteralPath $packageFolder -Recurse -Force
}
if (Test-Path -LiteralPath $archive) {
  Remove-Item -LiteralPath $archive -Force
}

Copy-Item -LiteralPath 'web-app' -Destination $packageFolder -Recurse
Compress-Archive -LiteralPath $packageFolder -DestinationPath $archive -CompressionLevel Optimal

Write-Host "Created $archive"
