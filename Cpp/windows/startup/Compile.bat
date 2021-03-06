@ECHO USAGE: Compile.bat

@echo off
cd %~dp0
call ..\..\windows\Versions.bat

:: Make sure our compiler environment is configured
if defined VSINSTALLDIR goto envdefined
if "%ProgramFiles(x86)%" == "" set "ProgramFiles(x86)=%ProgramFiles%"
call "%ProgramFiles(x86)%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
:envdefined
set INCLUDE=%INCLUDE%;%microsoftsdk%\Include
set LIB=%LIB%;%microsoftsdk%\Lib

if exist .\Release rmdir /S /Q .\Release
mkdir .\Release

Set cFlags=/nologo /MT /EHsc /W0 /Wp64^
 /I "%MK%\Cpp\src\include"^
 /D NDEBUG /D _UNICODE /D UNICODE /D _CRT_SECURE_NO_DEPRECATE /Fo".\Release\\" /c

Set cFiles="%MK%\Cpp\windows\startup\startup.cpp"

Set lFlags=/OUT:"Release\startup.exe" /INCREMENTAL:NO /NOLOGO^
 /MANIFEST /MANIFESTFILE:"Release\startup.exe.intermediate.manifest"^
 /SUBSYSTEM:WINDOWS User32.lib

Set lFiles=".\Release\startup.obj" ".\Release\startup.res"

echo on
rc.exe /l 0x409 /fo".\Release\startup.res" ".\startup.rc"
cl.exe %cFlags% %cFiles%
link.exe %lFlags% %lFiles%
mt.exe -manifest ".\Release\startup.exe.intermediate.manifest" -outputresource:".\Release\startup.exe";1
@echo off

echo.
if exist ".\Release\startup.exe" (echo ----------- runPortable.exe SUCCESS!) else (echo ----------- runPortable.exe COMPILE FAILED...)
echo.
