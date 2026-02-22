# Refreshes PATH and starts the dev server (fixes Node not found in Cursor terminal)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Set-Location $PSScriptRoot
npm run dev
