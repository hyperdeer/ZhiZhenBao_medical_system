@echo off
setlocal EnableExtensions
cd /d "%~dp0"

rem Conda env name (change if yours differs)
set "ENV_NAME=pytorch"
set "CONDA_CMD="

if defined CONDA_EXE if exist "%CONDA_EXE%" set "CONDA_CMD=%CONDA_EXE%"

if not defined CONDA_CMD if exist "D:\miniconda\condabin\conda.bat" set "CONDA_CMD=D:\miniconda\condabin\conda.bat"
if not defined CONDA_CMD if exist "%USERPROFILE%\miniconda3\condabin\conda.bat" set "CONDA_CMD=%USERPROFILE%\miniconda3\condabin\conda.bat"
if not defined CONDA_CMD if exist "%USERPROFILE%\anaconda3\condabin\conda.bat" set "CONDA_CMD=%USERPROFILE%\anaconda3\condabin\conda.bat"
if not defined CONDA_CMD if exist "%LOCALAPPDATA%\miniconda3\condabin\conda.bat" set "CONDA_CMD=%LOCALAPPDATA%\miniconda3\condabin\conda.bat"
if not defined CONDA_CMD if exist "%LOCALAPPDATA%\anaconda3\condabin\conda.bat" set "CONDA_CMD=%LOCALAPPDATA%\anaconda3\condabin\conda.bat"
if not defined CONDA_CMD if exist "%ProgramData%\miniconda3\condabin\conda.bat" set "CONDA_CMD=%ProgramData%\miniconda3\condabin\conda.bat"
if not defined CONDA_CMD if exist "%ProgramData%\Anaconda3\condabin\conda.bat" set "CONDA_CMD=%ProgramData%\Anaconda3\condabin\conda.bat"
if not defined CONDA_CMD if exist "C:\ProgramData\miniconda3\condabin\conda.bat" set "CONDA_CMD=C:\ProgramData\miniconda3\condabin\conda.bat"

if not defined CONDA_CMD for /f "delims=" %%I in ('where conda 2^>nul') do set "CONDA_CMD=%%I" & goto conda_ok

:conda_ok
if not defined CONDA_CMD (
  echo [ERROR] conda not found. Install Miniconda/Anaconda or add conda to PATH.
  pause
  exit /b 1
)

echo Web: http://127.0.0.1:8765
echo Conda env: %ENV_NAME%
echo Stop: Ctrl+C
echo.

call "%CONDA_CMD%" run -n "%ENV_NAME%" python -m uvicorn server:app --host 127.0.0.1 --port 8765
if errorlevel 1 (
  echo.
  echo [ERROR] Failed to start in env "%ENV_NAME%".
  echo Install deps:
  echo   call "%CONDA_CMD%" run -n "%ENV_NAME%" python -m pip install -r requirements.txt
  pause
  exit /b 1
)

endlocal
