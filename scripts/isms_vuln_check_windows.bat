@echo off
setlocal EnableDelayedExpansion
title ISMS-P Windows Vulnerability Check

:: ============================================================================
:: ISMS-P Windows PC Vulnerability Check Script
:: Double-click to run. Result saved to Desktop as text file.
:: ============================================================================

:: --- Admin privilege check and elevation ---
openfiles >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    echo Set UAC = CreateObject^("Shell.Application"^) > "%TEMP%\isms_elevate.vbs"
    echo UAC.ShellExecute "cmd.exe", "/k ""%~f0""", "%~dp0", "runas", 1 >> "%TEMP%\isms_elevate.vbs"
    cscript //nologo "%TEMP%\isms_elevate.vbs"
    del "%TEMP%\isms_elevate.vbs" >nul 2>&1
    exit /b
)
cd /d "%~dp0"

:: --- Setup ---
for /f "tokens=*" %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TIMESTAMP=%%I"
set "RESULT_FILE=%~dp0ISMS_VulnCheck_Result_%TIMESTAMP%.txt"
set TOTAL_CHECKS=0
set VULN_COUNT=0
set WARN_COUNT=0
set PASS_COUNT=0
set INFO_COUNT=0

:: --- Header ---
echo ============================================================================ > "%RESULT_FILE%"
echo  ISMS-P Windows Vulnerability Check Report >> "%RESULT_FILE%"
echo ============================================================================ >> "%RESULT_FILE%"
echo. >> "%RESULT_FILE%"
echo  Date: %date% %time% >> "%RESULT_FILE%"
echo  Computer: %COMPUTERNAME% >> "%RESULT_FILE%"
echo  User: %USERNAME% >> "%RESULT_FILE%"
echo  OS: >> "%RESULT_FILE%"
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "[Environment]::OSVersion.VersionString"') do echo   %%a >> "%RESULT_FILE%"
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "Get-CimInstance Win32_OperatingSystem | Select-Object -ExpandProperty Caption"') do echo   %%a >> "%RESULT_FILE%"
echo. >> "%RESULT_FILE%"
echo  Standard: ISMS-P Certification [Korea Information Security Management System] >> "%RESULT_FILE%"
echo  Controls: 2.5[Auth], 2.6[Access], 2.9[Ops], 2.10[Security], 2.11[Incident] >> "%RESULT_FILE%"
echo  Severity: VULN[Critical] / WARN[Warning] / PASS[Good] / INFO[Reference] >> "%RESULT_FILE%"
echo ============================================================================ >> "%RESULT_FILE%"
echo. >> "%RESULT_FILE%"

echo =========================================================
echo  ISMS-P Windows Vulnerability Check Starting...
echo  Result file: %RESULT_FILE%
echo =========================================================
echo.

:: ============================================================================
:: SECTION 1: Account Management [ISMS 2.5]
:: ============================================================================
echo [1/7] Checking Account Management...
echo ============================================================================ >> "%RESULT_FILE%"
echo  [1] Account Management [ISMS 2.5] >> "%RESULT_FILE%"
echo ============================================================================ >> "%RESULT_FILE%"
echo. >> "%RESULT_FILE%"

:: 1.1 Guest account
set /a TOTAL_CHECKS+=1
echo --- [1.1] Guest Account Disabled [ISMS 2.5.1] --- >> "%RESULT_FILE%"
for /f "tokens=*" %%r in ('powershell -NoProfile -Command "$g = Get-LocalUser Guest -EA SilentlyContinue; if ($g -and $g.Enabled) {'ON'} else {'OFF'}"') do set "GUEST=%%r"
if "!GUEST!"=="OFF" (
    echo [PASS] Guest account is disabled. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [VULN] Guest account is ENABLED. >> "%RESULT_FILE%"
    echo   Fix: Disable Guest in Computer Management - Local Users and Groups >> "%RESULT_FILE%"
    set /a VULN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 1.2 Local accounts list
set /a TOTAL_CHECKS+=1
echo --- [1.2] Local Account List [ISMS 2.5.1] --- >> "%RESULT_FILE%"
echo [INFO] Registered local accounts [review for unnecessary ones]: >> "%RESULT_FILE%"
powershell -NoProfile -Command "Get-LocalUser | ForEach-Object { '  ' + $_.Name + ' [Enabled=' + $_.Enabled + ']' }" >> "%RESULT_FILE%" 2>nul
set /a INFO_COUNT+=1
echo. >> "%RESULT_FILE%"

:: 1.3 Administrator account rename
set /a TOTAL_CHECKS+=1
echo --- [1.3] Administrator Account Rename [ISMS 2.5.5] --- >> "%RESULT_FILE%"
for /f "tokens=*" %%r in ('powershell -NoProfile -Command "if (Get-LocalUser Administrator -EA SilentlyContinue) {'EXISTS'} else {'RENAMED'}"') do set "ADMCHK=%%r"
if "!ADMCHK!"=="EXISTS" (
    echo [WARN] Default 'Administrator' account name is unchanged. >> "%RESULT_FILE%"
    echo   Fix: Rename to a non-guessable name >> "%RESULT_FILE%"
    set /a WARN_COUNT+=1
) else (
    echo [PASS] Default Administrator account is renamed or disabled. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 1.4 Last logon user display
set /a TOTAL_CHECKS+=1
echo --- [1.4] Last Logon User Display [ISMS 2.5.3] --- >> "%RESULT_FILE%"
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" /v DontDisplayLastUserName 2>nul | findstr "0x1" >nul 2>&1
if %errorlevel% equ 0 (
    echo [PASS] Last logon username is hidden on login screen. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [WARN] Last logon username is displayed on login screen. >> "%RESULT_FILE%"
    echo   Fix: Enable 'Interactive logon: Do not display last user name' >> "%RESULT_FILE%"
    set /a WARN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: ============================================================================
:: SECTION 2: Password Policy [ISMS 2.5.4]
:: ============================================================================
echo [2/7] Checking Password Policy...
echo ============================================================================ >> "%RESULT_FILE%"
echo  [2] Password Policy [ISMS 2.5.4] >> "%RESULT_FILE%"
echo ============================================================================ >> "%RESULT_FILE%"
echo. >> "%RESULT_FILE%"

:: Read password policy via PowerShell secedit
powershell -NoProfile -Command "$cfg = \"$env:TEMP\isms_secpol.cfg\"; secedit /export /cfg $cfg 2>&1 | Out-Null; if (Test-Path $cfg) { $c = Get-Content $cfg -Raw; $r = @(0,0,0,0,0,0); if ($c -match 'MinimumPasswordLength\s*=\s*(\d+)') {$r[0]=$Matches[1]}; if ($c -match 'PasswordComplexity\s*=\s*(\d+)') {$r[1]=$Matches[1]}; if ($c -match 'MaximumPasswordAge\s*=\s*(\d+)') {$r[2]=$Matches[1]}; if ($c -match 'MinimumPasswordAge\s*=\s*(\d+)') {$r[3]=$Matches[1]}; if ($c -match 'PasswordHistorySize\s*=\s*(\d+)') {$r[4]=$Matches[1]}; if ($c -match 'LockoutBadCount\s*=\s*(\d+)') {$r[5]=$Matches[1]}; Remove-Item $cfg -Force; $r -join ',' } else { '0,0,0,0,0,0' }" > "%TEMP%\isms_pwpol.txt" 2>nul
set "MIN_PWD_LEN=0"
set "PWD_COMPLEX=0"
set "MAX_PWD_AGE=0"
set "MIN_PWD_AGE=0"
set "PWD_HISTORY=0"
set "LOCKOUT_THRESHOLD=0"
for /f "tokens=1-6 delims=," %%a in ('type "%TEMP%\isms_pwpol.txt"') do (
    set "MIN_PWD_LEN=%%a"
    set "PWD_COMPLEX=%%b"
    set "MAX_PWD_AGE=%%c"
    set "MIN_PWD_AGE=%%d"
    set "PWD_HISTORY=%%e"
    set "LOCKOUT_THRESHOLD=%%f"
)
del "%TEMP%\isms_pwpol.txt" >nul 2>&1

:: 2.1 Min password length
set /a TOTAL_CHECKS+=1
echo --- [2.1] Minimum Password Length --- >> "%RESULT_FILE%"
if !MIN_PWD_LEN! GEQ 8 (
    echo [PASS] Min password length: !MIN_PWD_LEN! chars [8+ OK] >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [VULN] Min password length: !MIN_PWD_LEN! chars [below 8] >> "%RESULT_FILE%"
    echo   Fix: Set minimum password length to 8+ in Local Security Policy >> "%RESULT_FILE%"
    set /a VULN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 2.2 Password complexity
set /a TOTAL_CHECKS+=1
echo --- [2.2] Password Complexity --- >> "%RESULT_FILE%"
if "!PWD_COMPLEX!"=="1" (
    echo [PASS] Password complexity requirement is enabled. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [VULN] Password complexity requirement is DISABLED. >> "%RESULT_FILE%"
    echo   Fix: Enable 'Password must meet complexity requirements' >> "%RESULT_FILE%"
    set /a VULN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 2.3 Max password age
set /a TOTAL_CHECKS+=1
echo --- [2.3] Maximum Password Age --- >> "%RESULT_FILE%"
if !MAX_PWD_AGE! LEQ 90 if !MAX_PWD_AGE! GTR 0 (
    echo [PASS] Max password age: !MAX_PWD_AGE! days [90 or less OK] >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [VULN] Max password age: !MAX_PWD_AGE! days [over 90 or unlimited] >> "%RESULT_FILE%"
    echo   Fix: Set max password age to 90 days or less >> "%RESULT_FILE%"
    set /a VULN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 2.4 Min password age
set /a TOTAL_CHECKS+=1
echo --- [2.4] Minimum Password Age --- >> "%RESULT_FILE%"
if !MIN_PWD_AGE! GEQ 1 (
    echo [PASS] Min password age: !MIN_PWD_AGE! days [1+ OK] >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [WARN] Min password age: !MIN_PWD_AGE! days [not set] >> "%RESULT_FILE%"
    echo   Fix: Set minimum password age to 1+ days >> "%RESULT_FILE%"
    set /a WARN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 2.5 Password history
set /a TOTAL_CHECKS+=1
echo --- [2.5] Password History --- >> "%RESULT_FILE%"
if !PWD_HISTORY! GEQ 12 (
    echo [PASS] Password history: !PWD_HISTORY! [12+ OK] >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [WARN] Password history: !PWD_HISTORY! [below 12] >> "%RESULT_FILE%"
    echo   Fix: Set password history to remember 12+ passwords >> "%RESULT_FILE%"
    set /a WARN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 2.6 Account lockout
set /a TOTAL_CHECKS+=1
echo --- [2.6] Account Lockout Threshold --- >> "%RESULT_FILE%"
if !LOCKOUT_THRESHOLD! GEQ 1 if !LOCKOUT_THRESHOLD! LEQ 5 (
    echo [PASS] Account lockout: !LOCKOUT_THRESHOLD! attempts [5 or less OK] >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [VULN] Account lockout: !LOCKOUT_THRESHOLD! [not set or over 5] >> "%RESULT_FILE%"
    echo   Fix: Set account lockout threshold to 5 or fewer attempts >> "%RESULT_FILE%"
    set /a VULN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: ============================================================================
:: SECTION 3: Services and Network [ISMS 2.6, 2.10]
:: ============================================================================
echo [3/7] Checking Services and Network...
echo ============================================================================ >> "%RESULT_FILE%"
echo  [3] Services and Network [ISMS 2.6, 2.10] >> "%RESULT_FILE%"
echo ============================================================================ >> "%RESULT_FILE%"
echo. >> "%RESULT_FILE%"

:: 3.1 Risky services
set /a TOTAL_CHECKS+=1
echo --- [3.1] Risky Services Running --- >> "%RESULT_FILE%"
set "RISKY_SVC_FOUND=0"
for %%s in (TlntSvr SNMP RemoteRegistry Fax XblGameSave WMPNetworkSvc) do (
    sc query %%s 2>nul | findstr "RUNNING" >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [!] Running: %%s >> "%RESULT_FILE%"
        set "RISKY_SVC_FOUND=1"
    )
)
if "!RISKY_SVC_FOUND!"=="0" (
    echo [PASS] No risky services running [Telnet, SNMP, RemoteRegistry, etc.] >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [VULN] Unnecessary risky services are running. >> "%RESULT_FILE%"
    echo   Fix: Stop and disable unused services >> "%RESULT_FILE%"
    set /a VULN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 3.2 RDP
set /a TOTAL_CHECKS+=1
echo --- [3.2] Remote Desktop / RDP [ISMS 2.6.6] --- >> "%RESULT_FILE%"
reg query "HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server" /v fDenyTSConnections 2>nul | findstr "0x1" >nul 2>&1
if %errorlevel% equ 0 (
    echo [PASS] Remote Desktop is disabled. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [WARN] Remote Desktop is enabled. >> "%RESULT_FILE%"
    echo   Fix: Disable if not needed. If needed, enable NLA and restrict by IP. >> "%RESULT_FILE%"
    set /a WARN_COUNT+=1
    reg query "HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" /v UserAuthentication 2>nul | findstr "0x1" >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [INFO] NLA [Network Level Authentication] is enabled. >> "%RESULT_FILE%"
    ) else (
        echo   [VULN] NLA is DISABLED - enable immediately. >> "%RESULT_FILE%"
    )
)
echo. >> "%RESULT_FILE%"

:: 3.3 Shared folders
set /a TOTAL_CHECKS+=1
echo --- [3.3] Shared Folders [ISMS 2.6.1] --- >> "%RESULT_FILE%"
powershell -NoProfile -Command "$s = Get-SmbShare -EA SilentlyContinue | Where-Object {-not $_.Name.EndsWith('$')}; if ($s) {$s | ForEach-Object {'  SHARE: ' + $_.Name + ' -> ' + $_.Path}; 'HAS_CUSTOM'} else {'NO_CUSTOM'}" > "%TEMP%\isms_share.txt" 2>nul
set "SHARE_RESULT=NO_CUSTOM"
for /f "tokens=*" %%r in ('type "%TEMP%\isms_share.txt"') do (
    if "%%r"=="HAS_CUSTOM" (
        set "SHARE_RESULT=HAS_CUSTOM"
    ) else if "%%r"=="NO_CUSTOM" (
        set "SHARE_RESULT=NO_CUSTOM"
    ) else (
        echo %%r >> "%RESULT_FILE%"
    )
)
if "!SHARE_RESULT!"=="NO_CUSTOM" (
    echo [PASS] No user-defined shares [only default admin shares]. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [WARN] User-defined shared folders exist. Review permissions. >> "%RESULT_FILE%"
    echo   Fix: Remove unnecessary shares or apply least-privilege >> "%RESULT_FILE%"
    set /a WARN_COUNT+=1
)
del "%TEMP%\isms_share.txt" >nul 2>&1
echo. >> "%RESULT_FILE%"

:: 3.4 Firewall
set /a TOTAL_CHECKS+=1
echo --- [3.4] Windows Firewall [ISMS 2.6.1] --- >> "%RESULT_FILE%"
for /f "tokens=*" %%r in ('powershell -NoProfile -Command "$off = Get-NetFirewallProfile -EA SilentlyContinue | Where-Object {-not $_.Enabled}; if ($off) {$off | ForEach-Object {$_.Name + ': OFF'}; 'FW_ISSUE'} else {'FW_OK'}"') do (
    if "%%r"=="FW_OK" (
        echo [PASS] Windows Firewall is ON for all profiles. >> "%RESULT_FILE%"
        set /a PASS_COUNT+=1
    ) else if "%%r"=="FW_ISSUE" (
        echo [VULN] Firewall is OFF on one or more profiles. >> "%RESULT_FILE%"
        echo   Fix: Enable Windows Firewall on all profiles >> "%RESULT_FILE%"
        set /a VULN_COUNT+=1
    ) else (
        echo   [!] %%r >> "%RESULT_FILE%"
    )
)
echo. >> "%RESULT_FILE%"

:: ============================================================================
:: SECTION 4: Patch Management [ISMS 2.10.8]
:: ============================================================================
echo [4/7] Checking Patches...
echo ============================================================================ >> "%RESULT_FILE%"
echo  [4] Patch Management [ISMS 2.10.8, 2.10.9] >> "%RESULT_FILE%"
echo ============================================================================ >> "%RESULT_FILE%"
echo. >> "%RESULT_FILE%"

:: 4.1 Recent updates
set /a TOTAL_CHECKS+=1
echo --- [4.1] Recent Windows Updates --- >> "%RESULT_FILE%"
echo [INFO] Last 10 installed updates: >> "%RESULT_FILE%"
powershell -NoProfile -Command "Get-HotFix | Sort-Object InstalledOn -Descending -EA SilentlyContinue | Select-Object -First 10 | Format-Table HotFixID, InstalledOn, Description -AutoSize | Out-String -Stream | Where-Object {$_.Trim()}" >> "%RESULT_FILE%" 2>nul
set /a INFO_COUNT+=1
echo. >> "%RESULT_FILE%"

:: 4.2 Auto-update
set /a TOTAL_CHECKS+=1
echo --- [4.2] Automatic Update Setting --- >> "%RESULT_FILE%"
reg query "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" /v NoAutoUpdate 2>nul | findstr "0x1" >nul 2>&1
if %errorlevel% equ 0 (
    echo [VULN] Automatic updates DISABLED by policy. >> "%RESULT_FILE%"
    echo   Fix: Enable auto-update or establish manual update schedule >> "%RESULT_FILE%"
    set /a VULN_COUNT+=1
) else (
    echo [PASS] Automatic updates are not disabled. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: ============================================================================
:: SECTION 5: Audit and Logging [ISMS 2.9.4/2.9.5]
:: ============================================================================
echo [5/7] Checking Audit Policy...
echo ============================================================================ >> "%RESULT_FILE%"
echo  [5] Audit and Logging [ISMS 2.9.4, 2.9.5] >> "%RESULT_FILE%"
echo ============================================================================ >> "%RESULT_FILE%"
echo. >> "%RESULT_FILE%"

:: 5.1 Audit policy - CSV mode for locale-independent output
set /a TOTAL_CHECKS+=1
echo --- [5.1] Audit Policy Overview --- >> "%RESULT_FILE%"
echo [INFO] Current audit policy: >> "%RESULT_FILE%"
powershell -NoProfile -Command "$guids = @{System='{69979848-797A-11D9-BED3-505054503030}';'Logon/Logoff'='{69979849-797A-11D9-BED3-505054503030}';'Object Access'='{6997984A-797A-11D9-BED3-505054503030}';'Privilege Use'='{6997984B-797A-11D9-BED3-505054503030}';'Detailed Tracking'='{6997984C-797A-11D9-BED3-505054503030}';'Policy Change'='{6997984D-797A-11D9-BED3-505054503030}';'Account Mgmt'='{6997984E-797A-11D9-BED3-505054503030}';'DS Access'='{6997984F-797A-11D9-BED3-505054503030}';'Account Logon'='{69979850-797A-11D9-BED3-505054503030}'}; foreach($c in $guids.GetEnumerator()){$r=auditpol /get /category:$($c.Value) /r 2>&1|ConvertFrom-Csv -EA SilentlyContinue; if($r){foreach($i in $r){if($i.'Inclusion Setting'){'  {0,-42} {1}' -f $i.Subcategory,$i.'Inclusion Setting'}}}}" >> "%RESULT_FILE%" 2>nul
set /a INFO_COUNT+=1
echo. >> "%RESULT_FILE%"

:: 5.2 Logon audit - GUID for locale independence
set /a TOTAL_CHECKS+=1
echo --- [5.2] Logon Event Auditing --- >> "%RESULT_FILE%"
for /f "tokens=*" %%r in ('powershell -NoProfile -Command "$r=auditpol /get /subcategory:''{0CCE9215-69AE-11D9-BED3-505054503030}'' /r 2>&1|ConvertFrom-Csv -EA SilentlyContinue; if($r.''Inclusion Setting'' -match ''Success and Failure''){'OK'}else{'FAIL'}"') do set "LOGON_AUDIT=%%r"
if "!LOGON_AUDIT!"=="OK" (
    echo [PASS] Logon success/failure auditing is enabled. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [VULN] Logon event auditing is not fully configured. >> "%RESULT_FILE%"
    echo   Fix: auditpol /set /subcategory:"Logon" /success:enable /failure:enable >> "%RESULT_FILE%"
    set /a VULN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 5.3 Event log size
set /a TOTAL_CHECKS+=1
echo --- [5.3] Security Event Log Size --- >> "%RESULT_FILE%"
set "SEC_LOG_OK=0"
for /f "tokens=3" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Services\EventLog\Security" /v MaxSize 2^>nul ^| findstr "MaxSize"') do (
    set /a "SEC_LOG_SIZE=%%a / 1048576"
    if !SEC_LOG_SIZE! GEQ 10 (
        echo [PASS] Security log size: ~!SEC_LOG_SIZE!MB [10MB+ OK] >> "%RESULT_FILE%"
        set "SEC_LOG_OK=1"
        set /a PASS_COUNT+=1
    ) else (
        echo [WARN] Security log size: ~!SEC_LOG_SIZE!MB [below 10MB] >> "%RESULT_FILE%"
        echo   Fix: Set security log max to 10MB+ in Event Viewer >> "%RESULT_FILE%"
        set "SEC_LOG_OK=1"
        set /a WARN_COUNT+=1
    )
)
if "!SEC_LOG_OK!"=="0" (
    echo [INFO] Could not determine security event log size. >> "%RESULT_FILE%"
    set /a INFO_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: ============================================================================
:: SECTION 6: Security Settings [ISMS 2.7, 2.10]
:: ============================================================================
echo [6/7] Checking Security Settings...
echo ============================================================================ >> "%RESULT_FILE%"
echo  [6] Security Settings [ISMS 2.7, 2.10, 2.11] >> "%RESULT_FILE%"
echo ============================================================================ >> "%RESULT_FILE%"
echo. >> "%RESULT_FILE%"

:: 6.1 Screen saver
set /a TOTAL_CHECKS+=1
echo --- [6.1] Screen Saver Lock --- >> "%RESULT_FILE%"
reg query "HKCU\Control Panel\Desktop" /v ScreenSaveActive 2>nul | findstr "1" >nul 2>&1
if %errorlevel% equ 0 (
    reg query "HKCU\Control Panel\Desktop" /v ScreenSaverIsSecure 2>nul | findstr "1" >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "tokens=3" %%a in ('reg query "HKCU\Control Panel\Desktop" /v ScreenSaveTimeOut 2^>nul ^| findstr "ScreenSaveTimeOut"') do (
            set /a "SS_MIN=%%a / 60"
            if !SS_MIN! LEQ 10 (
                echo [PASS] Screen saver locks after !SS_MIN! min [10 min or less OK] >> "%RESULT_FILE%"
                set /a PASS_COUNT+=1
            ) else (
                echo [WARN] Screen saver locks after !SS_MIN! min [over 10 min] >> "%RESULT_FILE%"
                echo   Fix: Set screen saver timeout to 10 min or less >> "%RESULT_FILE%"
                set /a WARN_COUNT+=1
            )
        )
    ) else (
        echo [VULN] Screen saver has NO password lock. >> "%RESULT_FILE%"
        echo   Fix: Enable 'On resume, display logon screen' >> "%RESULT_FILE%"
        set /a VULN_COUNT+=1
    )
) else (
    echo [VULN] Screen saver is DISABLED. >> "%RESULT_FILE%"
    echo   Fix: Enable screen saver with password lock [10 min or less] >> "%RESULT_FILE%"
    set /a VULN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 6.2 BitLocker
set /a TOTAL_CHECKS+=1
echo --- [6.2] BitLocker Encryption [ISMS 2.7.1] --- >> "%RESULT_FILE%"
for /f "tokens=*" %%r in ('powershell -NoProfile -Command "$v = Get-BitLockerVolume -MountPoint C: -EA SilentlyContinue; if ($v -and $v.ProtectionStatus -eq ''On'') {''BL_ON''} else {''BL_OFF''}"') do set "BLCHK=%%r"
if "!BLCHK!"=="BL_ON" (
    echo [PASS] BitLocker is enabled on C: drive. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [WARN] BitLocker is NOT enabled on C: drive. >> "%RESULT_FILE%"
    echo   Fix: Enable BitLocker especially on laptops >> "%RESULT_FILE%"
    set /a WARN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 6.3 Windows Defender
set /a TOTAL_CHECKS+=1
echo --- [6.3] Windows Defender / Antivirus [ISMS 2.10.9] --- >> "%RESULT_FILE%"
for /f "tokens=1,2 delims=," %%a in ('powershell -NoProfile -Command "try{$s=Get-MpComputerStatus -EA Stop;if($s.AntivirusEnabled){''ENABLED,''+$s.AntivirusSignatureAge}else{''DISABLED,0''}}catch{''ERROR,0''}"') do (
    set "AV_STATUS=%%a"
    set "SIG_AGE=%%b"
)
if "!AV_STATUS!"=="ENABLED" (
    if !SIG_AGE! LEQ 7 (
        echo [PASS] Defender ON, signatures !SIG_AGE! days old [7 days or less OK] >> "%RESULT_FILE%"
        set /a PASS_COUNT+=1
    ) else (
        echo [WARN] Defender ON, signatures !SIG_AGE! days old [over 7 days] >> "%RESULT_FILE%"
        echo   Fix: Update virus definitions >> "%RESULT_FILE%"
        set /a WARN_COUNT+=1
    )
) else if "!AV_STATUS!"=="DISABLED" (
    echo [VULN] Windows Defender is DISABLED. >> "%RESULT_FILE%"
    echo   Fix: Enable antivirus immediately >> "%RESULT_FILE%"
    set /a VULN_COUNT+=1
) else (
    echo [INFO] Cannot check Defender [3rd-party AV may be active]. >> "%RESULT_FILE%"
    set /a INFO_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 6.4 SMBv1
set /a TOTAL_CHECKS+=1
echo --- [6.4] SMBv1 Protocol [ISMS 2.10] --- >> "%RESULT_FILE%"
for /f "tokens=*" %%r in ('powershell -NoProfile -Command "try{if((Get-SmbServerConfiguration -EA Stop).EnableSMB1Protocol){''ON''}else{''OFF''}}catch{''UNKNOWN''}"') do set "SMB1=%%r"
if "!SMB1!"=="OFF" (
    echo [PASS] SMBv1 is disabled. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else if "!SMB1!"=="ON" (
    echo [VULN] SMBv1 is ENABLED [WannaCry vulnerable]. >> "%RESULT_FILE%"
    echo   Fix: Set-SmbServerConfiguration -EnableSMB1Protocol $false >> "%RESULT_FILE%"
    set /a VULN_COUNT+=1
) else (
    echo [INFO] Cannot determine SMBv1 status. >> "%RESULT_FILE%"
    set /a INFO_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 6.5 UAC
set /a TOTAL_CHECKS+=1
echo --- [6.5] UAC [User Account Control] --- >> "%RESULT_FILE%"
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" /v EnableLUA 2>nul | findstr "0x1" >nul 2>&1
if %errorlevel% equ 0 (
    echo [PASS] UAC is enabled. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [VULN] UAC is DISABLED. >> "%RESULT_FILE%"
    echo   Fix: Enable UAC in Control Panel - User Accounts >> "%RESULT_FILE%"
    set /a VULN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 6.6 AutoRun
set /a TOTAL_CHECKS+=1
echo --- [6.6] AutoRun / Removable Media [ISMS 2.10.7] --- >> "%RESULT_FILE%"
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v NoDriveTypeAutoRun 2>nul | findstr "0xff\|0xFF" >nul 2>&1
if %errorlevel% equ 0 (
    echo [PASS] AutoRun disabled for all drives. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [WARN] AutoRun is not fully disabled. >> "%RESULT_FILE%"
    echo   Fix: Disable AutoRun for all drives via Group Policy >> "%RESULT_FILE%"
    set /a WARN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: ============================================================================
:: SECTION 7: Additional [ISMS 2.9, 2.11]
:: ============================================================================
echo [7/7] Additional Checks...
echo ============================================================================ >> "%RESULT_FILE%"
echo  [7] Additional Security [ISMS 2.9, 2.11] >> "%RESULT_FILE%"
echo ============================================================================ >> "%RESULT_FILE%"
echo. >> "%RESULT_FILE%"

:: 7.1 PowerShell policy
set /a TOTAL_CHECKS+=1
echo --- [7.1] PowerShell Execution Policy --- >> "%RESULT_FILE%"
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "Get-ExecutionPolicy"') do set "PS_POLICY=%%a"
if /i "!PS_POLICY!"=="Restricted" (
    echo [PASS] PowerShell policy: !PS_POLICY! >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else if /i "!PS_POLICY!"=="AllSigned" (
    echo [PASS] PowerShell policy: !PS_POLICY! >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [WARN] PowerShell policy: !PS_POLICY! >> "%RESULT_FILE%"
    echo   Fix: Set-ExecutionPolicy Restricted or AllSigned >> "%RESULT_FILE%"
    set /a WARN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 7.2 WinRM
set /a TOTAL_CHECKS+=1
echo --- [7.2] WinRM Remote Management [ISMS 2.6.6] --- >> "%RESULT_FILE%"
sc query WinRM 2>nul | findstr "RUNNING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] WinRM service is running. >> "%RESULT_FILE%"
    echo   Fix: Disable WinRM if remote management not needed >> "%RESULT_FILE%"
    set /a WARN_COUNT+=1
) else (
    echo [PASS] WinRM service is not running. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 7.3 NTP
set /a TOTAL_CHECKS+=1
echo --- [7.3] Time Synchronization / NTP [ISMS 2.9.6] --- >> "%RESULT_FILE%"
for /f "tokens=*" %%r in ('powershell -NoProfile -Command "$svc = Get-Service w32time -EA SilentlyContinue; if ($svc -and $svc.Status -eq ''Running'') {''NTP_OK''} else {''NTP_FAIL''}"') do set "NTPCHK=%%r"
if "!NTPCHK!"=="NTP_OK" (
    echo [PASS] Windows Time service is running. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [WARN] Time sync service is inactive. >> "%RESULT_FILE%"
    echo   Fix: Enable w32tm and configure NTP >> "%RESULT_FILE%"
    set /a WARN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 7.4 Legal notice
set /a TOTAL_CHECKS+=1
echo --- [7.4] Login Legal Notice [ISMS 2.5.3] --- >> "%RESULT_FILE%"
set "LEGAL_NOTICE="
for /f "tokens=2,*" %%a in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" /v LegalNoticeText 2^>nul ^| findstr "LegalNoticeText"') do set "LEGAL_NOTICE=%%b"
if defined LEGAL_NOTICE (
    echo [PASS] Login legal notice is configured. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [WARN] No login legal notice message. >> "%RESULT_FILE%"
    echo   Fix: Set a security warning message for login screen >> "%RESULT_FILE%"
    set /a WARN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 7.5 USB storage
set /a TOTAL_CHECKS+=1
echo --- [7.5] USB Storage [ISMS 2.10.7] --- >> "%RESULT_FILE%"
reg query "HKLM\SYSTEM\CurrentControlSet\Services\USBSTOR" /v Start 2>nul | findstr "0x4" >nul 2>&1
if %errorlevel% equ 0 (
    echo [PASS] USB storage devices are blocked. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [INFO] USB storage devices are enabled. >> "%RESULT_FILE%"
    echo   Note: Consider restricting USB per security policy >> "%RESULT_FILE%"
    set /a INFO_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: 7.6 Hosts file
set /a TOTAL_CHECKS+=1
echo --- [7.6] Hosts File Integrity --- >> "%RESULT_FILE%"
set "HOSTS_MODIFIED=0"
for /f "usebackq tokens=*" %%a in ("%SYSTEMROOT%\System32\drivers\etc\hosts") do (
    echo %%a | findstr /v "^#" | findstr /v "^$" | findstr /v "localhost" >nul 2>&1
    if !errorlevel! equ 0 (
        set "HOSTS_MODIFIED=1"
    )
)
if "!HOSTS_MODIFIED!"=="0" (
    echo [PASS] No suspicious entries in hosts file. >> "%RESULT_FILE%"
    set /a PASS_COUNT+=1
) else (
    echo [WARN] Custom entries in hosts file. >> "%RESULT_FILE%"
    echo   Fix: Review %SYSTEMROOT%\System32\drivers\etc\hosts >> "%RESULT_FILE%"
    echo [INFO] Hosts entries: >> "%RESULT_FILE%"
    for /f "usebackq tokens=*" %%a in ("%SYSTEMROOT%\System32\drivers\etc\hosts") do (
        echo %%a | findstr /v "^#" | findstr /v "^$" >nul 2>&1
        if !errorlevel! equ 0 echo   %%a >> "%RESULT_FILE%"
    )
    set /a WARN_COUNT+=1
)
echo. >> "%RESULT_FILE%"

:: ============================================================================
:: SUMMARY
:: ============================================================================
set /a "TOTAL_SCORE=PASS_COUNT * 100 / TOTAL_CHECKS"

echo ============================================================================ >> "%RESULT_FILE%"
echo  SUMMARY >> "%RESULT_FILE%"
echo ============================================================================ >> "%RESULT_FILE%"
echo. >> "%RESULT_FILE%"
echo  Total checks:    %TOTAL_CHECKS% >> "%RESULT_FILE%"
echo  -------------------------------- >> "%RESULT_FILE%"
echo  [VULN] Critical: %VULN_COUNT% >> "%RESULT_FILE%"
echo  [WARN] Warning:  %WARN_COUNT% >> "%RESULT_FILE%"
echo  [PASS] Good:     %PASS_COUNT% >> "%RESULT_FILE%"
echo  [INFO] Info:     %INFO_COUNT% >> "%RESULT_FILE%"
echo  -------------------------------- >> "%RESULT_FILE%"
echo  Security Score:  ~%TOTAL_SCORE%%% >> "%RESULT_FILE%"
echo. >> "%RESULT_FILE%"

if %VULN_COUNT% GTR 0 (
    echo  [!] %VULN_COUNT% critical issues found. Immediate action required. >> "%RESULT_FILE%"
)
if %WARN_COUNT% GTR 0 (
    echo  [*] %WARN_COUNT% warnings found. Improvement recommended. >> "%RESULT_FILE%"
)
echo. >> "%RESULT_FILE%"
echo ============================================================================ >> "%RESULT_FILE%"
echo  ISMS-P Control Mapping >> "%RESULT_FILE%"
echo ============================================================================ >> "%RESULT_FILE%"
echo. >> "%RESULT_FILE%"
echo  2.5.1 User Account Mgmt       - Checks 1.1~1.4 >> "%RESULT_FILE%"
echo  2.5.3 User Authentication     - Checks 1.4, 7.4 >> "%RESULT_FILE%"
echo  2.5.4 Password Management     - Checks 2.1~2.6 >> "%RESULT_FILE%"
echo  2.5.5 Privileged Account Mgmt - Check 1.3 >> "%RESULT_FILE%"
echo  2.6.1 Network Access Control  - Checks 3.3, 3.4 >> "%RESULT_FILE%"
echo  2.6.6 Remote Access Control   - Checks 3.2, 7.2 >> "%RESULT_FILE%"
echo  2.7.1 Encryption Policy       - Check 6.2 >> "%RESULT_FILE%"
echo  2.9.4 Log Management          - Checks 5.1~5.3 >> "%RESULT_FILE%"
echo  2.9.5 Log Review              - Check 5.2 >> "%RESULT_FILE%"
echo  2.9.6 Time Synchronization    - Check 7.3 >> "%RESULT_FILE%"
echo  2.10.7 Removable Media        - Checks 6.6, 7.5 >> "%RESULT_FILE%"
echo  2.10.8 Patch Management       - Checks 4.1, 4.2 >> "%RESULT_FILE%"
echo  2.10.9 Malware Control        - Check 6.3 >> "%RESULT_FILE%"
echo  2.11.2 Vulnerability Check    - This entire script >> "%RESULT_FILE%"
echo. >> "%RESULT_FILE%"
echo ============================================================================ >> "%RESULT_FILE%"
echo  End of Report >> "%RESULT_FILE%"
echo ============================================================================ >> "%RESULT_FILE%"

:: --- Done ---
echo.
echo =========================================================
echo  Scan Complete!
echo.
echo  Total: %TOTAL_CHECKS% checks
echo  VULN: %VULN_COUNT%  WARN: %WARN_COUNT%  PASS: %PASS_COUNT%  INFO: %INFO_COUNT%
echo.
echo  Result: %RESULT_FILE%
echo =========================================================
echo.

echo Press any key to exit...
pause >nul
endlocal
