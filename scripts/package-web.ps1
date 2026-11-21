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

# A build folder can also be a running installation. Ship generated assets,
# never its database, environment, backups or other local configuration.
New-Item -ItemType Directory -Path $packageFolder | Out-Null
foreach ($item in @('dist', 'server', 'package.json', 'start-web.bat', 'start-web.sh', '.env.example', 'README.txt')) {
  Copy-Item -LiteralPath (Join-Path 'web-app' $item) -Destination $packageFolder -Recurse
}
$dataFolder = Join-Path $packageFolder 'data'
New-Item -ItemType Directory -Path $dataFolder | Out-Null
Copy-Item -LiteralPath 'web-app/data/README.txt' -Destination $dataFolder
Compress-Archive -LiteralPath $packageFolder -DestinationPath $archive -CompressionLevel Optimal

Write-Host "Created $archive"
