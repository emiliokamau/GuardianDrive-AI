param(
    [int]$Port = 8501,
    [string]$App = ""
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$pythonExe = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Error "Virtual environment python not found at $pythonExe. Create venv first: python -m venv venv"
    exit 1
}

$argsList = @("run_app.py", "--port", "$Port")
if ($App -ne "") {
    $argsList += @("--app", $App)
}

& $pythonExe @argsList
exit $LASTEXITCODE
