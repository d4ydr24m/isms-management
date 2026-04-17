# ============================================================================
# ISMS-P Windows PC Vulnerability Check Script (RTR-only)
# For CrowdStrike Falcon RTR
# ============================================================================
# Version: 1.0
# Description: Windows 보안 설정 확인 스크립트 (결과를 표준출력으로만 출력)
# Usage (RTR): runscript -CloudFile="isms_vuln_check_windows_rtr"
# Notes:
#   - No result file is generated. All output is streamed to stdout so that
#     RTR can capture and display it after the scan completes.
#   - No interactive prompts (RTR is non-interactive).
#   - No self-elevation: RTR runs commands as SYSTEM by default.
# ============================================================================

# --- Pre-flight Check ---
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Output "ERROR: This script must be run as administrator (RTR runs as SYSTEM by default)."
    exit 1
}

# --- Setup ---
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$totalChecks = 0
$vulnCount = 0
$warnCount = 0
$passCount = 0
$infoCount = 0

# --- Helper functions (write to stdout) ---
function Out-Line {
    param([string]$Text)
    Write-Output $Text
}

function Add-Pass {
    param([string]$Msg)
    Out-Line "[PASS] $Msg"
    $script:passCount++
}
function Add-Vuln {
    param([string]$Msg, [string]$Fix)
    Out-Line "[VULN] $Msg"
    if ($Fix) { Out-Line "  Fix: $Fix" }
    $script:vulnCount++
}
function Add-Warn {
    param([string]$Msg, [string]$Fix)
    Out-Line "[WARN] $Msg"
    if ($Fix) { Out-Line "  Fix: $Fix" }
    $script:warnCount++
}
function Add-Info {
    param([string]$Msg)
    Out-Line "[INFO] $Msg"
    $script:infoCount++
}

# --- Header ---
$osCaption = (Get-CimInstance Win32_OperatingSystem).Caption
$osVersion = [Environment]::OSVersion.VersionString

Out-Line "============================================================================"
Out-Line " ISMS-P Windows Vulnerability Check Report (RTR)"
Out-Line "============================================================================"
Out-Line ""
Out-Line " Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Out-Line " Computer: $env:COMPUTERNAME"
Out-Line " User: $env:USERNAME"
Out-Line " OS: $osCaption ($osVersion)"
Out-Line ""
Out-Line " Standard: ISMS-P Certification [Korea Information Security Management System]"
Out-Line " Controls: 2.5[Auth], 2.6[Access], 2.9[Ops], 2.10[Security], 2.11[Incident]"
Out-Line " Severity: VULN[Critical] / WARN[Warning] / PASS[Good] / INFO[Reference]"
Out-Line "============================================================================"
Out-Line ""

# ============================================================================
# SECTION 1: Account Management [ISMS 2.5]
# ============================================================================
Out-Line "============================================================================"
Out-Line " [1] Account Management [ISMS 2.5]"
Out-Line "============================================================================"
Out-Line ""

# 1.1 Guest account
$totalChecks++
Out-Line "--- [1.1] Guest Account Disabled [ISMS 2.5.1] ---"
$guest = Get-LocalUser -Name Guest -ErrorAction SilentlyContinue
if ($guest -and $guest.Enabled) {
    Add-Vuln "Guest account is ENABLED." "Disable Guest in Computer Management - Local Users and Groups"
} else {
    Add-Pass "Guest account is disabled."
}
Out-Line ""

# 1.2 Local accounts list
$totalChecks++
Out-Line "--- [1.2] Local Account List [ISMS 2.5.1] ---"
Add-Info "Registered local accounts [review for unnecessary ones]:"
Get-LocalUser | ForEach-Object {
    Out-Line "  $($_.Name) [Enabled=$($_.Enabled)]"
}
Out-Line ""

# 1.3 Administrator account rename
$totalChecks++
Out-Line "--- [1.3] Administrator Account Rename [ISMS 2.5.5] ---"
$admin = Get-LocalUser -Name Administrator -ErrorAction SilentlyContinue
if ($admin) {
    Add-Warn "Default 'Administrator' account name is unchanged." "Rename to a non-guessable name"
} else {
    Add-Pass "Default Administrator account is renamed or disabled."
}
Out-Line ""

# 1.4 Last logon user display
$totalChecks++
Out-Line "--- [1.4] Last Logon User Display [ISMS 2.5.3] ---"
$val = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -Name DontDisplayLastUserName -ErrorAction SilentlyContinue).DontDisplayLastUserName
if ($val -eq 1) {
    Add-Pass "Last logon username is hidden on login screen."
} else {
    Add-Warn "Last logon username is displayed on login screen." "Enable 'Interactive logon: Do not display last user name'"
}
Out-Line ""

# ============================================================================
# SECTION 2: Password Policy [ISMS 2.5.4]
# ============================================================================
Out-Line "============================================================================"
Out-Line " [2] Password Policy [ISMS 2.5.4]"
Out-Line "============================================================================"
Out-Line ""

# Export security policy via secedit
$secpolFile = Join-Path $env:TEMP "isms_secpol_$timestamp.cfg"
secedit /export /cfg $secpolFile 2>&1 | Out-Null
$secpol = if (Test-Path $secpolFile) { Get-Content $secpolFile -Raw } else { "" }

function Get-SecpolValue {
    param([string]$Key)
    if ($secpol -match "$Key\s*=\s*(\d+)") { [int]$Matches[1] } else { 0 }
}

$minPwdLen = Get-SecpolValue "MinimumPasswordLength"
$pwdComplex = Get-SecpolValue "PasswordComplexity"
$maxPwdAge = Get-SecpolValue "MaximumPasswordAge"
$minPwdAge = Get-SecpolValue "MinimumPasswordAge"
$pwdHistory = Get-SecpolValue "PasswordHistorySize"
$lockoutThreshold = Get-SecpolValue "LockoutBadCount"

if (Test-Path $secpolFile) { Remove-Item $secpolFile -Force }

# 2.1 Min password length
$totalChecks++
Out-Line "--- [2.1] Minimum Password Length ---"
if ($minPwdLen -ge 8) {
    Add-Pass "Min password length: $minPwdLen chars [8+ OK]"
} else {
    Add-Vuln "Min password length: $minPwdLen chars [below 8]" "Set minimum password length to 8+ in Local Security Policy"
}
Out-Line ""

# 2.2 Password complexity
$totalChecks++
Out-Line "--- [2.2] Password Complexity ---"
if ($pwdComplex -eq 1) {
    Add-Pass "Password complexity requirement is enabled."
} else {
    Add-Vuln "Password complexity requirement is DISABLED." "Enable 'Password must meet complexity requirements'"
}
Out-Line ""

# 2.3 Max password age
$totalChecks++
Out-Line "--- [2.3] Maximum Password Age ---"
if ($maxPwdAge -gt 0 -and $maxPwdAge -le 90) {
    Add-Pass "Max password age: $maxPwdAge days [90 or less OK]"
} else {
    Add-Vuln "Max password age: $maxPwdAge days [over 90 or unlimited]" "Set max password age to 90 days or less"
}
Out-Line ""

# 2.4 Min password age
$totalChecks++
Out-Line "--- [2.4] Minimum Password Age ---"
if ($minPwdAge -ge 1) {
    Add-Pass "Min password age: $minPwdAge days [1+ OK]"
} else {
    Add-Warn "Min password age: $minPwdAge days [not set]" "Set minimum password age to 1+ days"
}
Out-Line ""

# 2.5 Password history
$totalChecks++
Out-Line "--- [2.5] Password History ---"
if ($pwdHistory -ge 12) {
    Add-Pass "Password history: $pwdHistory [12+ OK]"
} else {
    Add-Warn "Password history: $pwdHistory [below 12]" "Set password history to remember 12+ passwords"
}
Out-Line ""

# 2.6 Account lockout
$totalChecks++
Out-Line "--- [2.6] Account Lockout Threshold ---"
if ($lockoutThreshold -ge 1 -and $lockoutThreshold -le 5) {
    Add-Pass "Account lockout: $lockoutThreshold attempts [5 or less OK]"
} elseif ($lockoutThreshold -ge 6 -and $lockoutThreshold -le 10) {
    Add-Warn "Account lockout: $lockoutThreshold attempts [over 5, within 10]" "Consider reducing to 5 or fewer attempts"
} else {
    Add-Vuln "Account lockout: $lockoutThreshold [not set or over 10]" "Set account lockout threshold to 10 or fewer attempts"
}
Out-Line ""

# ============================================================================
# SECTION 3: Services and Network [ISMS 2.6, 2.10]
# ============================================================================
Out-Line "============================================================================"
Out-Line " [3] Services and Network [ISMS 2.6, 2.10]"
Out-Line "============================================================================"
Out-Line ""

# 3.1 Risky services
$totalChecks++
Out-Line "--- [3.1] Risky Services Running ---"
$riskyServices = @('TlntSvr','SNMP','RemoteRegistry','Fax','XblGameSave','WMPNetworkSvc')
$running = @()
foreach ($svcName in $riskyServices) {
    $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq 'Running') { $running += $svcName }
}
if ($running.Count -eq 0) {
    Add-Pass "No risky services running [Telnet, SNMP, RemoteRegistry, etc.]"
} else {
    foreach ($r in $running) { Out-Line "  [!] Running: $r" }
    Add-Vuln "Unnecessary risky services are running." "Stop and disable unused services"
}
Out-Line ""

# 3.2 RDP
$totalChecks++
Out-Line "--- [3.2] Remote Desktop / RDP [ISMS 2.6.6] ---"
$rdpDisabled = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server" -Name fDenyTSConnections -ErrorAction SilentlyContinue).fDenyTSConnections
if ($rdpDisabled -eq 1) {
    Add-Pass "Remote Desktop is disabled."
} else {
    Add-Warn "Remote Desktop is enabled." "Disable if not needed. If needed, enable NLA and restrict by IP."
    $nla = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" -Name UserAuthentication -ErrorAction SilentlyContinue).UserAuthentication
    if ($nla -eq 1) {
        Out-Line "  [INFO] NLA [Network Level Authentication] is enabled."
    } else {
        Out-Line "  [VULN] NLA is DISABLED - enable immediately."
    }
}
Out-Line ""

# 3.3 Shared folders
$totalChecks++
Out-Line "--- [3.3] Shared Folders [ISMS 2.6.1] ---"
$shares = Get-SmbShare -ErrorAction SilentlyContinue | Where-Object { -not $_.Name.EndsWith('$') }
if ($shares) {
    foreach ($s in $shares) { Out-Line "  SHARE: $($s.Name) -> $($s.Path)" }
    Add-Warn "User-defined shared folders exist. Review permissions." "Remove unnecessary shares or apply least-privilege"
} else {
    Add-Pass "No user-defined shares [only default admin shares]."
}
Out-Line ""

# 3.4 Firewall
$totalChecks++
Out-Line "--- [3.4] Windows Firewall [ISMS 2.6.1] ---"
$fwOff = Get-NetFirewallProfile -ErrorAction SilentlyContinue | Where-Object { -not $_.Enabled }
if ($fwOff) {
    foreach ($p in $fwOff) { Out-Line "  [!] $($p.Name) profile: Firewall OFF" }
    Add-Vuln "Firewall is OFF on one or more profiles." "Enable Windows Firewall on all profiles"
} else {
    Add-Pass "Windows Firewall is ON for all profiles."
}
Out-Line ""

# ============================================================================
# SECTION 4: Patch Management [ISMS 2.10.8]
# ============================================================================
Out-Line "============================================================================"
Out-Line " [4] Patch Management [ISMS 2.10.8, 2.10.9]"
Out-Line "============================================================================"
Out-Line ""

# 4.1 Recent updates
$totalChecks++
Out-Line "--- [4.1] Recent Windows Updates ---"
Add-Info "Last 10 installed updates:"
$hotfixes = Get-HotFix | Sort-Object InstalledOn -Descending -ErrorAction SilentlyContinue | Select-Object -First 10
foreach ($hf in $hotfixes) {
    Out-Line ("  {0,-12} {1,-22} {2}" -f $hf.HotFixID, $hf.InstalledOn, $hf.Description)
}
Out-Line ""

# 4.2 Auto-update
$totalChecks++
Out-Line "--- [4.2] Automatic Update Setting ---"
$noAutoUpdate = (Get-ItemProperty "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" -Name NoAutoUpdate -ErrorAction SilentlyContinue).NoAutoUpdate
if ($noAutoUpdate -eq 1) {
    Add-Vuln "Automatic updates DISABLED by policy." "Enable auto-update or establish manual update schedule"
} else {
    Add-Pass "Automatic updates are not disabled."
}
Out-Line ""

# ============================================================================
# SECTION 5: Audit and Logging [ISMS 2.9.4/2.9.5]
# ============================================================================
Out-Line "============================================================================"
Out-Line " [5] Audit and Logging [ISMS 2.9.4, 2.9.5]"
Out-Line "============================================================================"
Out-Line ""

# Known GUID-to-English-name mapping
$guidNames = @{
    '{0CCE9210-69AE-11D9-BED3-505054503030}' = 'Security State Change'
    '{0CCE9211-69AE-11D9-BED3-505054503030}' = 'Security System Extension'
    '{0CCE9212-69AE-11D9-BED3-505054503030}' = 'System Integrity'
    '{0CCE9213-69AE-11D9-BED3-505054503030}' = 'IPsec Driver'
    '{0CCE9214-69AE-11D9-BED3-505054503030}' = 'Other System Events'
    '{0CCE9215-69AE-11D9-BED3-505054503030}' = 'Logon'
    '{0CCE9216-69AE-11D9-BED3-505054503030}' = 'Logoff'
    '{0CCE9217-69AE-11D9-BED3-505054503030}' = 'Account Lockout'
    '{0CCE9218-69AE-11D9-BED3-505054503030}' = 'IPsec Main Mode'
    '{0CCE9219-69AE-11D9-BED3-505054503030}' = 'IPsec Quick Mode'
    '{0CCE921A-69AE-11D9-BED3-505054503030}' = 'IPsec Extended Mode'
    '{0CCE921B-69AE-11D9-BED3-505054503030}' = 'Special Logon'
    '{0CCE921C-69AE-11D9-BED3-505054503030}' = 'Other Logon/Logoff'
    '{0CCE9220-69AE-11D9-BED3-505054503030}' = 'File System'
    '{0CCE9221-69AE-11D9-BED3-505054503030}' = 'Registry'
    '{0CCE9222-69AE-11D9-BED3-505054503030}' = 'Kernel Object'
    '{0CCE9223-69AE-11D9-BED3-505054503030}' = 'SAM'
    '{0CCE9224-69AE-11D9-BED3-505054503030}' = 'Certification Services'
    '{0CCE9225-69AE-11D9-BED3-505054503030}' = 'Application Generated'
    '{0CCE9226-69AE-11D9-BED3-505054503030}' = 'Handle Manipulation'
    '{0CCE9227-69AE-11D9-BED3-505054503030}' = 'File Share'
    '{0CCE9228-69AE-11D9-BED3-505054503030}' = 'Filtering Platform Packet Drop'
    '{0CCE9229-69AE-11D9-BED3-505054503030}' = 'Filtering Platform Connection'
    '{0CCE922A-69AE-11D9-BED3-505054503030}' = 'Other Object Access'
    '{0CCE922B-69AE-11D9-BED3-505054503030}' = 'Detailed File Share'
    '{0CCE9230-69AE-11D9-BED3-505054503030}' = 'Sensitive Privilege Use'
    '{0CCE9231-69AE-11D9-BED3-505054503030}' = 'Non Sensitive Privilege Use'
    '{0CCE9232-69AE-11D9-BED3-505054503030}' = 'Other Privilege Use'
    '{0CCE9233-69AE-11D9-BED3-505054503030}' = 'Process Creation'
    '{0CCE9234-69AE-11D9-BED3-505054503030}' = 'Process Termination'
    '{0CCE9235-69AE-11D9-BED3-505054503030}' = 'DPAPI Activity'
    '{0CCE9236-69AE-11D9-BED3-505054503030}' = 'RPC Events'
    '{0CCE9237-69AE-11D9-BED3-505054503030}' = 'Audit Policy Change'
    '{0CCE9238-69AE-11D9-BED3-505054503030}' = 'Authentication Policy Change'
    '{0CCE9239-69AE-11D9-BED3-505054503030}' = 'Authorization Policy Change'
    '{0CCE923A-69AE-11D9-BED3-505054503030}' = 'MPSSVC Rule-Level Policy Change'
    '{0CCE923B-69AE-11D9-BED3-505054503030}' = 'Filtering Platform Policy Change'
    '{0CCE923C-69AE-11D9-BED3-505054503030}' = 'Other Policy Change'
    '{0CCE923D-69AE-11D9-BED3-505054503030}' = 'Computer Account Management'
    '{0CCE923E-69AE-11D9-BED3-505054503030}' = 'Security Group Management'
    '{0CCE923F-69AE-11D9-BED3-505054503030}' = 'Distribution Group Management'
    '{0CCE9240-69AE-11D9-BED3-505054503030}' = 'Application Group Management'
    '{0CCE9241-69AE-11D9-BED3-505054503030}' = 'Other Account Management'
    '{0CCE9242-69AE-11D9-BED3-505054503030}' = 'User Account Management'
    '{0CCE9243-69AE-11D9-BED3-505054503030}' = 'Directory Service Access'
    '{0CCE9244-69AE-11D9-BED3-505054503030}' = 'Directory Service Changes'
    '{0CCE9245-69AE-11D9-BED3-505054503030}' = 'Directory Service Replication'
    '{0CCE9246-69AE-11D9-BED3-505054503030}' = 'Detailed Directory Service Replication'
    '{0CCE9247-69AE-11D9-BED3-505054503030}' = 'Credential Validation'
    '{0CCE9248-69AE-11D9-BED3-505054503030}' = 'Kerberos Service Ticket Operations'
    '{0CCE9249-69AE-11D9-BED3-505054503030}' = 'Other Account Logon'
    '{0CCE924A-69AE-11D9-BED3-505054503030}' = 'Kerberos Authentication Service'
}

# 5.1 Audit policy overview
$totalChecks++
Out-Line "--- [5.1] Audit Policy Overview ---"
Add-Info "Current audit policy:"
$logonOK = $false
$logonGUID = '{0CCE9215-69AE-11D9-BED3-505054503030}'

$raw = auditpol /get /category:* /r 2>$null
$csvLines = $raw | Where-Object { $_ -match ',' }
$csv = $csvLines | ConvertFrom-Csv -ErrorAction SilentlyContinue
if ($csv.Count -gt 0) {
    $cols = @($csv[0].PSObject.Properties.Name)
    foreach ($row in $csv) {
        $guid = $row.($cols[3])
        $setting = $row.($cols[4])
        if (-not $guid -or -not $setting) { continue }

        $subEn = if ($guidNames.ContainsKey($guid)) { $guidNames[$guid] } else { $row.($cols[2]) }
        Out-Line ("  {0,-42} {1}" -f $subEn, $setting)

        # For logon: "Success and Failure" = 3+ words in any language
        if ($guid -eq $logonGUID) {
            $words = ($setting.Trim() -split '\s+') | Where-Object { $_ }
            if ($words.Count -ge 3) { $logonOK = $true }
        }
    }
}
Out-Line ""

# 5.2 Logon audit
$totalChecks++
Out-Line "--- [5.2] Logon Event Auditing ---"
if ($logonOK) {
    Add-Pass "Logon success/failure auditing is enabled."
} else {
    Add-Vuln "Logon event auditing is not fully configured." "auditpol /set /subcategory:`"Logon`" /success:enable /failure:enable"
}
Out-Line ""

# 5.3 Event log size
$totalChecks++
Out-Line "--- [5.3] Security Event Log Size ---"
try {
    $log = Get-WinEvent -ListLog Security -ErrorAction Stop
    $sizeMB = [math]::Round($log.MaximumSizeInBytes / 1MB)
    if ($sizeMB -ge 10) {
        Add-Pass "Security log size: ${sizeMB}MB [10MB+ OK]"
    } else {
        Add-Warn "Security log size: ${sizeMB}MB [below 10MB]" "Set security log max to 10MB+ in Event Viewer"
    }
} catch {
    Add-Info "Could not determine security event log size."
}
Out-Line ""

# ============================================================================
# SECTION 6: Security Settings [ISMS 2.7, 2.10]
# ============================================================================
Out-Line "============================================================================"
Out-Line " [6] Security Settings [ISMS 2.7, 2.10, 2.11]"
Out-Line "============================================================================"
Out-Line ""

# 6.1 Screen saver
$totalChecks++
Out-Line "--- [6.1] Screen Saver Lock ---"
# Note: HKCU under RTR (SYSTEM) won't reflect the console user. Read by SID instead.
$consoleUser = $null
try {
    $explorer = Get-CimInstance Win32_Process -Filter "Name='explorer.exe'" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($explorer) {
        $owner = Invoke-CimMethod -InputObject $explorer -MethodName GetOwner -ErrorAction SilentlyContinue
        if ($owner -and $owner.User) {
            $consoleUser = if ($owner.Domain) { "$($owner.Domain)\$($owner.User)" } else { $owner.User }
        }
    }
} catch {}

$ssActive = $null
$ssSecure = $null
$ssTimeout = $null
if ($consoleUser) {
    try {
        $sid = (New-Object System.Security.Principal.NTAccount($consoleUser)).Translate([System.Security.Principal.SecurityIdentifier]).Value
        $hkuPath = "Registry::HKEY_USERS\$sid\Control Panel\Desktop"
        if (Test-Path $hkuPath) {
            $ssActive = (Get-ItemProperty $hkuPath -Name ScreenSaveActive -ErrorAction SilentlyContinue).ScreenSaveActive
            $ssSecure = (Get-ItemProperty $hkuPath -Name ScreenSaverIsSecure -ErrorAction SilentlyContinue).ScreenSaverIsSecure
            $ssTimeout = (Get-ItemProperty $hkuPath -Name ScreenSaveTimeOut -ErrorAction SilentlyContinue).ScreenSaveTimeOut
        }
    } catch {}
}
# Fallback: try current process HKCU (works in interactive shell, not under SYSTEM)
if ($null -eq $ssActive) {
    $ssActive = (Get-ItemProperty "HKCU:\Control Panel\Desktop" -Name ScreenSaveActive -ErrorAction SilentlyContinue).ScreenSaveActive
    $ssSecure = (Get-ItemProperty "HKCU:\Control Panel\Desktop" -Name ScreenSaverIsSecure -ErrorAction SilentlyContinue).ScreenSaverIsSecure
    $ssTimeout = (Get-ItemProperty "HKCU:\Control Panel\Desktop" -Name ScreenSaveTimeOut -ErrorAction SilentlyContinue).ScreenSaveTimeOut
}

if ($ssActive -eq '1') {
    if ($ssSecure -eq '1') {
        $ssMin = [math]::Floor([int]$ssTimeout / 60)
        if ($ssMin -le 10) {
            Add-Pass "Screen saver locks after $ssMin min [10 min or less OK]"
        } else {
            Add-Warn "Screen saver locks after $ssMin min [over 10 min]" "Set screen saver timeout to 10 min or less"
        }
    } else {
        Add-Vuln "Screen saver has NO password lock." "Enable 'On resume, display logon screen'"
    }
} else {
    Add-Vuln "Screen saver is DISABLED." "Enable screen saver with password lock [10 min or less]"
}
Out-Line ""

# 6.2 BitLocker
$totalChecks++
Out-Line "--- [6.2] BitLocker Encryption [ISMS 2.7.1] ---"
$bl = Get-BitLockerVolume -MountPoint C: -ErrorAction SilentlyContinue
if ($bl -and $bl.ProtectionStatus -eq 'On') {
    Add-Pass "BitLocker is enabled on C: drive."
} else {
    Add-Warn "BitLocker is NOT enabled on C: drive." "Enable BitLocker especially on laptops"
}
Out-Line ""

# 6.3 Antivirus
$totalChecks++
Out-Line "--- [6.3] Antivirus [ISMS 2.10.9] ---"
$avFound = $false
try {
    $avProducts = Get-CimInstance -Namespace "root/SecurityCenter2" -ClassName AntiVirusProduct -ErrorAction Stop
    foreach ($av in $avProducts) {
        $enabled = (($av.productState -shr 12) -band 0x1) -eq 1
        $upToDate = (($av.productState -shr 4) -band 0x1) -eq 0
        if ($av.displayName -ne 'Windows Defender' -and $enabled) {
            $status = if ($upToDate) { "up-to-date" } else { "definitions outdated" }
            Add-Pass "$($av.displayName) is active [$status]"
            $avFound = $true
        }
    }
} catch {}
if (-not $avFound) {
    try {
        $mpStatus = Get-MpComputerStatus -ErrorAction Stop
        if ($mpStatus.AntivirusEnabled) {
            $sigAge = $mpStatus.AntivirusSignatureAge
            if ($sigAge -le 7) {
                Add-Pass "Defender ON, signatures $sigAge days old [7 days or less OK]"
            } else {
                Add-Warn "Defender ON, signatures $sigAge days old [over 7 days]" "Update virus definitions"
            }
            $avFound = $true
        }
    } catch {}
}
if (-not $avFound) {
    Add-Vuln "No active antivirus detected." "Enable antivirus immediately"
}
Out-Line ""

# 6.4 SMBv1
$totalChecks++
Out-Line "--- [6.4] SMBv1 Protocol [ISMS 2.10] ---"
try {
    $smb1 = (Get-SmbServerConfiguration -ErrorAction Stop).EnableSMB1Protocol
    if ($smb1) {
        Add-Vuln "SMBv1 is ENABLED [WannaCry vulnerable]." "Set-SmbServerConfiguration -EnableSMB1Protocol `$false"
    } else {
        Add-Pass "SMBv1 is disabled."
    }
} catch {
    Add-Info "Cannot determine SMBv1 status."
}
Out-Line ""

# 6.5 UAC
$totalChecks++
Out-Line "--- [6.5] UAC [User Account Control] ---"
$uac = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -Name EnableLUA -ErrorAction SilentlyContinue).EnableLUA
if ($uac -eq 1) {
    Add-Pass "UAC is enabled."
} else {
    Add-Vuln "UAC is DISABLED." "Enable UAC in Control Panel - User Accounts"
}
Out-Line ""

# 6.6 AutoRun
$totalChecks++
Out-Line "--- [6.6] AutoRun / Removable Media [ISMS 2.10.7] ---"
$autorun = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" -Name NoDriveTypeAutoRun -ErrorAction SilentlyContinue).NoDriveTypeAutoRun
if ($autorun -ge 255) {
    Add-Pass "AutoRun disabled for all drives."
} else {
    Add-Warn "AutoRun is not fully disabled." "Disable AutoRun for all drives via Group Policy"
}
Out-Line ""

# ============================================================================
# SECTION 7: Additional [ISMS 2.9, 2.11]
# ============================================================================
Out-Line "============================================================================"
Out-Line " [7] Additional Security [ISMS 2.9, 2.11]"
Out-Line "============================================================================"
Out-Line ""

# 7.1 PowerShell policy
$totalChecks++
Out-Line "--- [7.1] PowerShell Execution Policy ---"
$psPolicy = Get-ExecutionPolicy -Scope LocalMachine
if ($psPolicy -in @('Restricted','AllSigned','RemoteSigned')) {
    Add-Pass "PowerShell policy: $psPolicy"
} else {
    Add-Warn "PowerShell policy: $psPolicy" "Set-ExecutionPolicy RemoteSigned or more restrictive"
}
Out-Line ""

# 7.2 WinRM
$totalChecks++
Out-Line "--- [7.2] WinRM Remote Management [ISMS 2.6.6] ---"
$winrm = Get-Service WinRM -ErrorAction SilentlyContinue
if ($winrm -and $winrm.Status -eq 'Running') {
    Add-Warn "WinRM service is running." "Disable WinRM if remote management not needed"
} else {
    Add-Pass "WinRM service is not running."
}
Out-Line ""

# 7.3 NTP
$totalChecks++
Out-Line "--- [7.3] Time Synchronization / NTP [ISMS 2.9.6] ---"
$w32time = Get-Service w32time -ErrorAction SilentlyContinue
if ($w32time -and ($w32time.Status -eq 'Running' -or $w32time.StartType -ne 'Disabled')) {
    Add-Pass "Windows Time service is configured."
} else {
    Add-Warn "Time sync service is disabled." "Enable w32tm and configure NTP"
}
Out-Line ""

# 7.4 Legal notice
$totalChecks++
Out-Line "--- [7.4] Login Legal Notice [ISMS 2.5.3] ---"
$notice = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -Name LegalNoticeText -ErrorAction SilentlyContinue).LegalNoticeText
if ($notice) {
    Add-Pass "Login legal notice is configured."
} else {
    Add-Warn "No login legal notice message." "Set a security warning message for login screen"
}
Out-Line ""

# 7.5 USB storage
$totalChecks++
Out-Line "--- [7.5] USB Storage [ISMS 2.10.7] ---"
$usbStart = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\USBSTOR" -Name Start -ErrorAction SilentlyContinue).Start
if ($usbStart -eq 4) {
    Add-Pass "USB storage devices are blocked."
} else {
    Add-Info "USB storage devices are enabled."
    Out-Line "  Note: Consider restricting USB per security policy"
}
Out-Line ""

# 7.6 Hosts file
$totalChecks++
Out-Line "--- [7.6] Hosts File Integrity ---"
$hostsPath = "$env:SYSTEMROOT\System32\drivers\etc\hosts"
$safePatterns = @('localhost','docker.internal','kubernetes.docker.internal','gateway.docker.internal','host.docker.internal','wsl','broadcasthost')
$suspicious = @()
foreach ($line in (Get-Content $hostsPath -ErrorAction SilentlyContinue)) {
    $t = $line.Trim()
    if ($t -eq '' -or $t.StartsWith('#')) { continue }
    $isSafe = $false
    foreach ($p in $safePatterns) {
        if ($t -match [regex]::Escape($p)) { $isSafe = $true; break }
    }
    if (-not $isSafe) { $suspicious += $t }
}
if ($suspicious.Count -eq 0) {
    Add-Pass "No suspicious entries in hosts file."
} else {
    Add-Warn "Unexpected entries in hosts file." "Review $hostsPath"
    Add-Info "Non-standard hosts entries:"
    foreach ($s in $suspicious) { Out-Line "  $s" }
}
Out-Line ""

# ============================================================================
# SUMMARY
# ============================================================================
$totalScore = if ($totalChecks -gt 0) { [math]::Round($passCount * 100 / $totalChecks) } else { 0 }

Out-Line "============================================================================"
Out-Line " SUMMARY"
Out-Line "============================================================================"
Out-Line ""
Out-Line " Total checks:    $totalChecks"
Out-Line " --------------------------------"
Out-Line " [VULN] Critical: $vulnCount"
Out-Line " [WARN] Warning:  $warnCount"
Out-Line " [PASS] Good:     $passCount"
Out-Line " [INFO] Info:     $infoCount"
Out-Line " --------------------------------"
Out-Line " Security Score:  ~${totalScore}%"
Out-Line ""

if ($vulnCount -gt 0) {
    Out-Line " [!] $vulnCount critical issues found. Immediate action required."
}
if ($warnCount -gt 0) {
    Out-Line " [*] $warnCount warnings found. Improvement recommended."
}

Out-Line ""
Out-Line "============================================================================"
Out-Line " ISMS-P Control Mapping"
Out-Line "============================================================================"
Out-Line ""
Out-Line " 2.5.1 User Account Mgmt       - Checks 1.1~1.4"
Out-Line " 2.5.3 User Authentication     - Checks 1.4, 7.4"
Out-Line " 2.5.4 Password Management     - Checks 2.1~2.6"
Out-Line " 2.5.5 Privileged Account Mgmt - Check 1.3"
Out-Line " 2.6.1 Network Access Control  - Checks 3.3, 3.4"
Out-Line " 2.6.6 Remote Access Control   - Checks 3.2, 7.2"
Out-Line " 2.7.1 Encryption Policy       - Check 6.2"
Out-Line " 2.9.4 Log Management          - Checks 5.1~5.3"
Out-Line " 2.9.5 Log Review              - Check 5.2"
Out-Line " 2.9.6 Time Synchronization    - Check 7.3"
Out-Line " 2.10.7 Removable Media        - Checks 6.6, 7.5"
Out-Line " 2.10.8 Patch Management       - Checks 4.1, 4.2"
Out-Line " 2.10.9 Malware Control        - Check 6.3"
Out-Line " 2.11.2 Vulnerability Check    - This entire script"
Out-Line ""
Out-Line "============================================================================"
Out-Line " Scan Complete"
Out-Line "============================================================================"
Out-Line " Total: $totalChecks checks  |  VULN: $vulnCount  WARN: $warnCount  PASS: $passCount  INFO: $infoCount"
Out-Line "============================================================================"
