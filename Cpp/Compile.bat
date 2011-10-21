@ECHO USAGE: Compile.bat [fileName] [NOSECURITY or DUMPCODES] (NOTE: fileName is not used)
if not exist "%MK%\Cpp\Release" mkdir "%MK%\Cpp\Release"
set CPPD=Cpp

set cFlags=
set lFlags=

cd "%MK%\%CPPD%"
call versions.bat

@echo off
Set arg2=%2
if defined arg2 (Set arg1=%arg2%) else Set arg1=%1
if not defined arg1 Set arg1=undefined

Set NOSECURITY=
Set SECURITYCPP=".\security.cpp"
Set SECURITYOBJ=".\xulsword\security.obj"
if %arg1%==NOSECURITY Set NOSECURITY=/D "NOSECURITY"& Set SECURITYCPP=& Set SECURITYOBJ=

Set DUMPCODES=
if %arg1%==DUMPCODES Set DUMPCODES=/D "DUMPCODES"

REM Changing "DEBUG" to "NDEBUG" turns off NS_WARNING etc.
Set cFlags=/nologo /W2 /MT /EHsc /O2 /Zc:wchar_t-^
 /I ".\crclib"^
 /I ".\\"^
 /I ".\swordMK\include"^
 /I ".\swordMK\src\utilfuns\win32"^
 /I ".\%sword%\include"^
 /I ".\cluceneMK\src"^
 /I ".\%clucene%\src"^
 /I "%MK%/%CPPD%/%sword%/include/internal/regex"^
 /I ".\%xulrunnerSDK%\xulrunner-sdk\include"^
 %NOSECURITY%%DUMPCODES% /D "WIN32_LEAN_AND_MEAN" /D "USELUCENE" /D "UNICODE" /D "_UNICODE" /D "NDEBUG" /D "XP_WIN" /D WIN32 /D "_WINDOWS" /D "_USRDLL" /D "XULSWORD_EXPORTS" /D "_WINDLL" /D "_AFXDLL" /D "_CRT_SECURE_NO_DEPRECATE" /Fp"xulsword/xulsword.pch" /Fo"xulsword/" /c

Set cFiles=%SECURITYCPP%^
 ".\xulsword.cpp"^
 ".\thmlhtmlxul.cpp"^
 ".\gbfhtmlxul.cpp"^
 ".\osishtmlxul.cpp"^
 ".\osisdictionary.cpp"^
 ".\swordMK\src\utilfuns\win32\dirent.cpp"

Set lFlags=libsword.lib libclucene.lib xpcom.lib xpcomglue_s.lib nspr4.lib crclib.lib /nologo /dll /incremental:no /manifest /manifestfile:"xulsword\xulsword.dll.manifest" /implib:"xulsword\xulsword.lib" /pdb:"xulsword/xulsword.pdb" /out:".\Release\xulsword.dll" /libpath:".\crclib\Release" /libpath:".\%xulrunnerSDK%\xulrunner-sdk\sdk\lib" /libpath:".\swordMK\lib\Release" /libpath:".\cluceneMK\lib\Release"
Set lFiles=%SECURITYOBJ%^
 ".\xulsword\xulsword.obj"^
 ".\xulsword\osishtmlxul.obj"^
 ".\xulsword\thmlhtmlxul.obj"^
 ".\xulsword\gbfhtmlxul.obj"^
 ".\xulsword\osisdictionary.obj"^
 ".\xulsword\dirent.obj"


if not defined VSINSTALLDIR call "%ProgramFiles%\Microsoft Visual Studio 8\Common7\Tools\VSVARS32.bat"
set INCLUDE=%INCLUDE%;%microsoftsdk%\Include
set LIB=%LIB%;%microsoftsdk%\Lib

echo on
mkdir xulsword
del "Release\xulsword.dll"
cl.exe %cFlags% %cFiles%
link.exe %lFlags% %lFiles%
mt.exe -manifest "xulsword\xulsword.dll.manifest" -outputresource:"Release\xulsword.dll";2
rmdir /S /Q xulsword

echo off
if not exist Release\xulsword.dll echo COMPILE FAILED& goto FINISH

ECHO Moving new xulsword.dll to xulrunner dir...
copy /Y "Release\xulsword.dll" ..\xulrunner\components
copy /Y "Release\ixulsword.xpt" ..\xulrunner\components
pushd ..\xulrunner
:: the next line alows us to "touch" .autoreg so that the new dll will self register upon next run
ECHO ...ignore the message generated by the following...
type > .autoreg

popd

:FINISH
