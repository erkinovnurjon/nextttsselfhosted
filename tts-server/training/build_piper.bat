@echo off
REM Piper espeakbridge + espeak-ng QO'LDA cmake build (scikit-build wrapper'siz — u VS18'ni tanimaydi)
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
set "PATH=C:\Projects\nexttts\tts-server\venv-piper\Scripts;%PATH%"
cd /d C:\Projects\nexttts\tts-server\training\piper1-gpl
set "CM=C:\Projects\nexttts\tts-server\venv-piper\Scripts\cmake.exe"
set "PY=C:\Projects\nexttts\tts-server\venv-piper\Scripts\python.exe"
"%CM%" -S . -B build_manual -G Ninja -DPython_EXECUTABLE="%PY%" -DCMAKE_BUILD_TYPE=Release
if errorlevel 1 ( echo CONFIGURE_FAILED & exit /b 1 )
"%CM%" --build build_manual
echo BUILD_EXIT=%ERRORLEVEL%
