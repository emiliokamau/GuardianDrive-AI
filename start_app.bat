@echo off
setlocal
cd /d "%~dp0"

set "PYEXE=%~dp0venv\Scripts\python.exe"
if not exist "%PYEXE%" (
  echo Virtual environment python not found at "%PYEXE%".
  echo Create it first: python -m venv venv
  exit /b 1
)

"%PYEXE%" run_app.py %*
exit /b %errorlevel%
