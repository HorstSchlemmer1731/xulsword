@ECHO USAGE: Compile.bat [fileName] [NOSECURITY or DUMPCODES] (NOTE: fileName is not used)
if not exist ".\Release" mkdir ".\Release"
set CPPD=Cpp

set cFlags=
set lFlags=

call versions.bat

@echo off
Set arg2=%2
if defined arg2 (Set arg1=%arg2%) else Set arg1=%1
if not defined arg1 Set arg1=undefined

Set NOSECURITY=
Set SECURITYCPP=".\security.cpp"
Set SECURITYOBJ=".\xulsword\security.obj"
if %arg1%==NOSECURITY Set NOSECURITY=/D "NOSECURITY"& Set SECURITYCPP=& Set SECURITYOBJ=

REM Changing "DEBUG" to "NDEBUG" turns off NS_WARNING etc.
Set cFlags=/nologo /W2 /LD /EHsc /O2^
 /I ".\\"^
 /I "%sword%\include"^
 /I "%sword%/include/internal/regex"^
 /FI "fileops.h"^
 /FI "redefs_sword.h"^
 /D "WIN32_LEAN_AND_MEAN" /D "USELUCENE" /D "UNICODE" /D "_UNICODE" /D "NDEBUG" /D "XP_WIN" /D WIN32 /D "_WINDOWS" /D "_USRDLL" /D "XULSWORD_EXPORTS" /D "_WINDLL" /D "_AFXDLL" /D "_CRT_SECURE_NO_DEPRECATE" /Fp"xulsword/xulsword.pch" /Fo"xulsword/" /c

Set cFiles=%SECURITYCPP%^
 ".\xulsword.cpp"^
 ".\dirent.cpp"^
 ".\fileops.cpp"
 
Set lFlags=libsword.lib libclucene.lib /nologo /dll /incremental:no /manifest /manifestfile:"xulsword\xulsword.dll.manifest" /implib:"xulsword\xulsword.lib" /pdb:"xulsword/xulsword.pdb" /out:".\Release\xulsword.dll" /libpath:".\swordMK\lib\Release" /libpath:".\cluceneMK\lib\Release"
Set lFiles=%SECURITYOBJ%^
 ".\xulsword\xulsword.obj"^
 ".\xulsword\dirent.obj"^
 ".\xulsword\fileops.obj"

if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%microsoftsdk%\Include
set LIB=%LIB%;%microsoftsdk%\Lib

echo on
mkdir xulsword
if exist ".\Release\xulsword.dll" del ".\Release\xulsword.dll"
cl.exe %cFlags% %cFiles%
link.exe %lFiles% %lFlags%
mt.exe -manifest "xulsword\xulsword.dll.manifest" -outputresource:"Release\xulsword.dll";2
rmdir /S /Q .\xulsword

echo off
if not exist Release\xulsword.dll echo COMPILE FAILED& goto FINISH

ECHO Moving new xulsword.dll to xulrunner dir...
copy /Y ".\Release\xulsword.dll" ..\build-files\%Name%\development\

:FINISH