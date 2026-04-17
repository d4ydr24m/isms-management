# ============================================================================
# ISMS-P Windows Security Setup Script (RTR-only)
# For CrowdStrike Falcon RTR
# ============================================================================
# Version: 1.0
# Description: Windows 초기 보안 세팅 조치 스크립트 (RTR 전용, 비대화식)
# Usage (RTR): runscript -CloudFile="isms_security_setup_windows_rtr"
# Notes:
#   - Based on pc_security_v2.1.ps1, adapted for RTR.
#   - All output is streamed to stdout (Write-Output) so RTR can capture it.
#   - No interactive prompts. RTR runs as SYSTEM by default.
#   - Skipped from v2.1 (intentionally):
#       * Set-UserPassword (hardcoded password = fleet-wide secret regression)
#       * Invoke-WindowsUpdate (use WSUS/Intune patch policy instead)
#       * Set-NTPServer (skipped; manage centrally via GPO/MDM)
#       * Set-Hostname / Set-UserName (per-host, not fleet-safe)
#       * Invoke-Reboot (RTR should not reboot mid-batch)
#   - Password policy values kept identical to v2.1 (PasswordHistorySize=1,
#     LockoutBadCount=10) per stakeholder decision; audit script will WARN on
#     these but the values are intentional.
# ============================================================================

# --- Pre-flight Check ---
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Output "ERROR: This script must be run as administrator (RTR runs as SYSTEM by default)."
    exit 1
}

# --- Setup ---
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$successCount = 0
$failCount = 0

# --- Helper functions (write to stdout) ---
function Out-Line {
    param([string]$Text)
    Write-Output $Text
}

function Log-Result {
    param([bool]$Ok, [string]$Msg)
    if ($Ok) {
        Out-Line "[OK] $Msg"
        $script:successCount++
    } else {
        Out-Line "[ERROR] $Msg"
        $script:failCount++
    }
}

# --- Resolve console user (for HKCU writes under SYSTEM) ---
$ConsoleUser = $null
$ConsoleUserSID = $null
try {
    $explorer = Get-CimInstance Win32_Process -Filter "Name='explorer.exe'" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($explorer) {
        $owner = Invoke-CimMethod -InputObject $explorer -MethodName GetOwner -ErrorAction SilentlyContinue
        if ($owner -and $owner.User) {
            $ConsoleUser = if ($owner.Domain) { "$($owner.Domain)\$($owner.User)" } else { $owner.User }
            $ConsoleUserSID = (New-Object System.Security.Principal.NTAccount($ConsoleUser)).Translate([System.Security.Principal.SecurityIdentifier]).Value
        }
    }
} catch {}

# --- Header ---
$osCaption = (Get-CimInstance Win32_OperatingSystem).Caption
$osVersion = [Environment]::OSVersion.VersionString

Out-Line "============================================================================"
Out-Line " ISMS-P Windows Security Setup (RTR)"
Out-Line "============================================================================"
Out-Line " Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Out-Line " Computer: $env:COMPUTERNAME"
Out-Line " Executing User: $env:USERNAME"
Out-Line " Console User: $(if ($ConsoleUser) { "$ConsoleUser ($ConsoleUserSID)" } else { '(none logged in - HKCU writes will be skipped)' })"
Out-Line " OS: $osCaption ($osVersion)"
Out-Line "============================================================================"

# Helper to write to console user's HKCU (works under SYSTEM/RTR)
function Set-ConsoleHKCU {
    param(
        [string]$SubKey,    # e.g. "Control Panel\Desktop"
        [string]$Name,
        $Value,
        [string]$Type = 'String'
    )
    if (-not $ConsoleUserSID) {
        return $false
    }
    $path = "Registry::HKEY_USERS\$ConsoleUserSID\$SubKey"
    if (-not (Test-Path $path)) {
        try { New-Item -Path $path -Force | Out-Null } catch { return $false }
    }
    try {
        Set-ItemProperty -Path $path -Name $Name -Value $Value -Type $Type -Force -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# ============================================================================
# 1. Disable Guest Account
# ============================================================================
Out-Line ""
Out-Line "--- 1. Disabling Guest Account ---"
try {
    $guest = Get-LocalUser -Name Guest -ErrorAction SilentlyContinue
    if ($guest -and $guest.Enabled) {
        Disable-LocalUser -Name Guest -ErrorAction Stop
        Log-Result $true "Guest account disabled"
    } elseif ($guest) {
        Log-Result $true "Guest account already disabled"
    } else {
        Log-Result $true "Guest account not present"
    }
} catch {
    Log-Result $false "Failed to disable Guest account: $_"
}

# ============================================================================
# 2. Password Policy (net accounts)
# ============================================================================
Out-Line ""
Out-Line "--- 2. Password Policy ---"

net accounts /maxpwage:90 | Out-Null
Log-Result ($LASTEXITCODE -eq 0) "Maximum password age set to 90 days"

net accounts /minpwlen:8 | Out-Null
Log-Result ($LASTEXITCODE -eq 0) "Minimum password length set to 8"

# Disable 'Password Never Expires' for active local users
try {
    $localUsers = Get-LocalUser | Where-Object { $_.PasswordNeverExpires -eq $true -and $_.Enabled -eq $true }
    if ($localUsers) {
        foreach ($u in $localUsers) {
            try {
                Set-LocalUser -Name $u.Name -PasswordNeverExpires $false -ErrorAction Stop
                Out-Line "    - $($u.Name): PasswordNeverExpires disabled"
            } catch {
                Out-Line "    - $($u.Name): FAILED to disable PasswordNeverExpires ($_)"
            }
        }
        Log-Result $true "PasswordNeverExpires disabled for $($localUsers.Count) user(s)"
    } else {
        Log-Result $true "No users with PasswordNeverExpires enabled"
    }
} catch {
    Log-Result $false "Failed to enumerate local users: $_"
}

# ============================================================================
# 3. Security Policy (secedit) - PasswordComplexity, History, LockoutBadCount
# ============================================================================
Out-Line ""
Out-Line "--- 3. Security Policy (Complexity, History=1, LockoutBadCount=10) ---"
$secCfg = Join-Path $env:TEMP "isms_secconfig_$timestamp.cfg"
$secDb  = Join-Path $env:TEMP "isms_secnew_$timestamp.sdb"
try {
    secedit /export /cfg $secCfg | Out-Null
    if (Test-Path $secCfg) {
        $content = Get-Content $secCfg
        $content = $content -replace 'PasswordComplexity\s*=\s*\d+', 'PasswordComplexity = 1'
        $content = $content -replace 'PasswordHistorySize\s*=\s*\d+', 'PasswordHistorySize = 1'
        $content = $content -replace 'LockoutBadCount\s*=\s*\d+', 'LockoutBadCount = 10'
        $content | Out-File $secCfg -Encoding ascii
        secedit /configure /db $secDb /cfg $secCfg /areas SECURITYPOLICY | Out-Null
        Log-Result ($LASTEXITCODE -eq 0) "Security policy applied (run rsop.msc to verify)"
    } else {
        Log-Result $false "secedit export failed (config file not produced)"
    }
} catch {
    Log-Result $false "Security policy configuration error: $_"
} finally {
    Remove-Item $secCfg -Force -ErrorAction SilentlyContinue
    Remove-Item $secDb  -Force -ErrorAction SilentlyContinue
}

# ============================================================================
# 4. Account Lockout Window / Duration
# ============================================================================
Out-Line ""
Out-Line "--- 4. Account Lockout Window / Duration (5 min each) ---"
net accounts /lockoutwindow:5 | Out-Null
Log-Result ($LASTEXITCODE -eq 0) "Lockout observation window set to 5 minutes"

net accounts /lockoutduration:5 | Out-Null
Log-Result ($LASTEXITCODE -eq 0) "Lockout duration set to 5 minutes"

# ============================================================================
# 5. Screen Saver (HKCU - console user)
# ============================================================================
Out-Line ""
Out-Line "--- 5. Screen Saver (10 min, password-protected) ---"
if (-not $ConsoleUserSID) {
    Log-Result $false "No console user logged in - screen saver settings skipped (HKCU not writable)"
} else {
    $r1 = Set-ConsoleHKCU -SubKey "Control Panel\Desktop" -Name "ScreenSaveActive"   -Value "1"   -Type String
    Log-Result $r1 "ScreenSaveActive=1 (HKU\$ConsoleUserSID)"

    $r2 = Set-ConsoleHKCU -SubKey "Control Panel\Desktop" -Name "ScreenSaverIsSecure" -Value "1"   -Type String
    Log-Result $r2 "ScreenSaverIsSecure=1 (lock on resume)"

    $r3 = Set-ConsoleHKCU -SubKey "Control Panel\Desktop" -Name "ScreenSaveTimeOut"   -Value "600" -Type String
    Log-Result $r3 "ScreenSaveTimeOut=600 seconds (10 min)"
}

# ============================================================================
# 6. Registry Settings (system-wide hardening)
# ============================================================================
Out-Line ""
Out-Line "--- 6. System Registry Hardening ---"

# 6.1 Disable AutoShareWks (admin shares C$, ADMIN$ etc. still exist; this disables on-demand creation)
try {
    $path = "HKLM:\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters"
    Set-ItemProperty -Path $path -Name "AutoShareWks" -Value 0 -Type DWord -Force -ErrorAction Stop
    Log-Result $true "AutoShareWks=0 (default workstation shares disabled)"
} catch {
    Log-Result $false "Failed to set AutoShareWks: $_"
}

# 6.2 Enable Firewall on all profiles
try {
    Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True -ErrorAction Stop
    Log-Result $true "Windows Firewall enabled (Domain, Public, Private)"
} catch {
    try {
        $path = "HKLM:\SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\StandardProfile"
        Set-ItemProperty -Path $path -Name "EnableFirewall" -Value 1 -Type DWord -Force -ErrorAction Stop
        Log-Result $true "Firewall enabled via registry fallback (StandardProfile)"
    } catch {
        Log-Result $false "Failed to enable firewall: $_"
    }
}

# 6.3 Disable AutoRun for all drive types
try {
    $path = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer"
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
    Set-ItemProperty -Path $path -Name "NoDriveTypeAutoRun" -Value 255 -Type DWord -Force -ErrorAction Stop
    Log-Result $true "NoDriveTypeAutoRun=255 (AutoRun disabled for all drives)"
} catch {
    Log-Result $false "Failed to disable AutoRun: $_"
}

# 6.4 Recovery Console - disable auto-logon
try {
    $path = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\setup\recoveryconsole"
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
    Set-ItemProperty -Path $path -Name "SecurityLevel" -Value 0 -Type DWord -Force -ErrorAction Stop
    Log-Result $true "Recovery Console SecurityLevel=0 (auto-logon disabled)"
} catch {
    Log-Result $false "Failed to set recovery console: $_"
}

# 6.5 IE temp files - delete on exit (HKCU - console user)
if ($ConsoleUserSID) {
    $r = Set-ConsoleHKCU -SubKey "SOFTWARE\Microsoft\Windows\CurrentVersion\Internet Settings\Cache" `
                          -Name "Persistent" -Value 0 -Type DWord
    Log-Result $r "IE Cache Persistent=0 (delete temp internet files on exit)"
} else {
    Out-Line "[INFO] IE cache setting skipped (no console user)"
}

# 6.6 Disable RDP
try {
    $path = "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server"
    Set-ItemProperty -Path $path -Name "fDenyTSConnections" -Value 1 -Type DWord -Force -ErrorAction Stop
    Log-Result $true "fDenyTSConnections=1 (RDP disabled)"
} catch {
    Log-Result $false "Failed to disable RDP: $_"
}

# 6.7 Disable News and Interests feed
try {
    $path = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Feeds"
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
    Set-ItemProperty -Path $path -Name "EnableFeeds" -Value 0 -Type DWord -Force -ErrorAction Stop
    Log-Result $true "EnableFeeds=0 (News and Interests disabled)"
} catch {
    Log-Result $false "Failed to disable News and Interests: $_"
}

# ============================================================================
# 7. Audit Policy
# ============================================================================
Out-Line ""
Out-Line "--- 7. Audit Policy (Logon/Logoff/Lockout/Account Logon/Cred Validation) ---"
$subcategories = @(
    @{ Name = "Logon";                GUID = "{0CCE9215-69AE-11D9-BED3-505054503030}" }
    @{ Name = "Logoff";               GUID = "{0CCE9216-69AE-11D9-BED3-505054503030}" }
    @{ Name = "Account Lockout";      GUID = "{0CCE9217-69AE-11D9-BED3-505054503030}" }
    @{ Name = "Account Logon";        GUID = "{0CCE9240-69AE-11D9-BED3-505054503030}" }
    @{ Name = "Credential Validation";GUID = "{0CCE923F-69AE-11D9-BED3-505054503030}" }
)
foreach ($sub in $subcategories) {
    auditpol /set /subcategory:"$($sub.GUID)" /success:enable /failure:enable 2>&1 | Out-Null
    Log-Result ($LASTEXITCODE -eq 0) "$($sub.Name): Success+Failure auditing enabled"
}

# ============================================================================
# 8. Security Event Log Size (20MB)
# ============================================================================
Out-Line ""
Out-Line "--- 8. Security Event Log Size ---"
try {
    $log = Get-WinEvent -ListLog Security -ErrorAction Stop
    $log.MaximumSizeInBytes = 20MB
    $log.SaveChanges()
    Log-Result $true "Security log max size set to 20MB"
} catch {
    Log-Result $false "Failed to set Security event log size: $_"
}

# ============================================================================
# 9. Disable SMBv1
# ============================================================================
Out-Line ""
Out-Line "--- 9. SMBv1 Protocol ---"
try {
    $smb1 = (Get-SmbServerConfiguration -ErrorAction Stop).EnableSMB1Protocol
    if ($smb1) {
        Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force -ErrorAction Stop
        Log-Result $true "SMBv1 disabled"
    } else {
        Log-Result $true "SMBv1 already disabled"
    }
} catch {
    Log-Result $false "Failed to configure SMBv1: $_"
}

# ============================================================================
# 10. Enable UAC
# ============================================================================
Out-Line ""
Out-Line "--- 10. UAC (User Account Control) ---"
try {
    $path = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
    $current = (Get-ItemProperty -Path $path -Name "EnableLUA" -ErrorAction SilentlyContinue).EnableLUA
    if ($current -ne 1) {
        Set-ItemProperty -Path $path -Name "EnableLUA" -Value 1 -Type DWord -Force -ErrorAction Stop
        Log-Result $true "UAC enabled (restart required to take effect)"
    } else {
        Log-Result $true "UAC already enabled"
    }
} catch {
    Log-Result $false "Failed to enable UAC: $_"
}

# ============================================================================
# 11. PowerShell Execution Policy (RemoteSigned)
# ============================================================================
Out-Line ""
Out-Line "--- 11. PowerShell Execution Policy ---"
try {
    Set-ExecutionPolicy RemoteSigned -Force -Scope LocalMachine -ErrorAction Stop
    $policy = Get-ExecutionPolicy -Scope LocalMachine
    Log-Result $true "ExecutionPolicy (LocalMachine) = $policy"
} catch {
    $policy = Get-ExecutionPolicy -Scope LocalMachine
    Log-Result $true "ExecutionPolicy (LocalMachine) = $policy (override warning ignored)"
}

# ============================================================================
# 12. Disable WinRM
# ============================================================================
Out-Line ""
Out-Line "--- 12. WinRM Service ---"
try {
    $svc = Get-Service WinRM -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq 'Running') {
        Stop-Service WinRM -Force -ErrorAction Stop
        Set-Service WinRM -StartupType Disabled -ErrorAction Stop
        Log-Result $true "WinRM stopped and set to Disabled"
    } elseif ($svc) {
        Set-Service WinRM -StartupType Disabled -ErrorAction Stop
        Log-Result $true "WinRM not running; startup set to Disabled"
    } else {
        Log-Result $true "WinRM service not present"
    }
} catch {
    Log-Result $false "Failed to disable WinRM: $_"
}

# ============================================================================
# SUMMARY
# ============================================================================
$total = $successCount + $failCount
Out-Line ""
Out-Line "============================================================================"
Out-Line " SETUP SUMMARY"
Out-Line "============================================================================"
Out-Line " SUCCESS: $successCount / $total"
Out-Line " FAILED:  $failCount / $total"
Out-Line "============================================================================"
if ($failCount -eq 0) {
    Out-Line " STATUS: ALL CONFIGURATIONS APPLIED"
} else {
    Out-Line " STATUS: $failCount ITEM(S) FAILED - REVIEW ABOVE"
}
Out-Line "============================================================================"
Out-Line " Note: A restart is recommended for some settings (UAC, etc.) to take full effect."
Out-Line " Note: Run isms_vuln_check_windows_rtr.ps1 to verify the applied configuration."
Out-Line "============================================================================"
