<#
.SYNOPSIS
    PC Security Configuration Script
.DESCRIPTION
    v2.0 Converted to PowerShell script
.NOTES
    Use pc_security_v2.0_launcher.bat to run this script
    Or run directly with: powershell -ExecutionPolicy Bypass -File "pc_security_v2.0.ps1"
#>

#region Admin Check

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
    Write-Host "Requesting administrator privileges..." -ForegroundColor Yellow
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Verb RunAs
    exit
}

#endregion

#region Functions

function Write-Header {
    Write-Host ""
    Write-Host "========================================================"
    Write-Host "             PC Security Configuration Script"
    Write-Host "========================================================"
    Write-Host ""
}

function Set-PasswordPolicy {
    Write-Host "    [ Password Max Age: 90 days ]"
    net accounts /maxpwage:90 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        net accounts | Select-String "Maximum password age"
    }
    Write-Host ""

    Write-Host "    [ Minimum Password Length: 8 ]"
    net accounts /minpwlen:8 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        net accounts | Select-String "Minimum password length"
    }
    Write-Host ""

    Write-Host "    [ Disable 'Password Never Expires' for all local users ]"
    try {
        $localUsers = Get-LocalUser | Where-Object { $_.PasswordNeverExpires -eq $true -and $_.Enabled -eq $true }
        if ($localUsers) {
            foreach ($user in $localUsers) {
                Set-LocalUser -Name $user.Name -PasswordNeverExpires $false
                Write-Host "    - $($user.Name): PasswordNeverExpires disabled"
            }
        } else {
            Write-Host "    - No users with 'Password Never Expires' enabled"
        }
    }
    catch {
        Write-Host "    [WARNING] Failed to update user password expiry settings: $_" -ForegroundColor Yellow
    }
    Write-Host ""
}

function Set-SecurityPolicy {
    Write-Host "    [ Password Complexity, History 1, Lockout Threshold 10 ]"

    $secConfigPath = Join-Path $env:TEMP "secconfig.cfg"

    secedit /export /cfg $secConfigPath | Out-Null

    $content = Get-Content $secConfigPath
    $content = $content -replace 'PasswordComplexity = 0', 'PasswordComplexity = 1'
    $content = $content -replace 'PasswordHistorySize = 0', 'PasswordHistorySize = 1'
    $content = $content -replace 'LockoutBadCount = 0', 'LockoutBadCount = 10'
    $content | Out-File $secConfigPath -Encoding ascii

    secedit /configure /db "$env:windir\securitynew.sdb" /cfg $secConfigPath /areas SECURITYPOLICY | Out-Null

    Remove-Item $secConfigPath -Force -ErrorAction SilentlyContinue

    Write-Host "    - Policy configured (run rsop.msc to verify)"
    Write-Host ""
}

function Set-AccountLockoutPolicy {
    Write-Host "    [ Lockout Window: 5 minutes ]"
    net accounts /lockoutwindow:5 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        net accounts | Select-String "Lockout observation window"
    }
    Write-Host ""

    Write-Host "    [ Lockout Duration: 5 minutes ]"
    net accounts /lockoutduration:5 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        net accounts | Select-String "Lockout duration"
    }
    Write-Host ""
}

function Set-ScreenSaver {
    Write-Host "    [ ScreenSaver Active ]"
    Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveActive" -Value "1" -Type String -Force
    $value = Get-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveActive"
    Write-Host "    ScreenSaveActive: $($value.ScreenSaveActive)"
    Write-Host ""

    Write-Host "    [ ScreenSaver Secure (Logon screen on resume) ]"
    Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaverIsSecure" -Value "1" -Type String -Force
    $value = Get-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaverIsSecure"
    Write-Host "    ScreenSaverIsSecure: $($value.ScreenSaverIsSecure)"
    Write-Host ""

    Write-Host "    [ ScreenSaver Timeout: 600 seconds (10 min) ]"
    Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveTimeOut" -Value "600" -Type String -Force
    $value = Get-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "ScreenSaveTimeOut"
    Write-Host "    ScreenSaveTimeOut: $($value.ScreenSaveTimeOut)"
    Write-Host ""
}

function Set-RegistrySettings {
    Write-Host "    [ Disable Default Share (AutoShareWks) ]"
    $path = "HKLM:\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters"
    Set-ItemProperty -Path $path -Name "AutoShareWks" -Value 0 -Type DWord -Force
    $value = Get-ItemProperty -Path $path -Name "AutoShareWks"
    Write-Host "    AutoShareWks: $($value.AutoShareWks)"
    Write-Host ""

    Write-Host "    [ Enable Firewall - All Profiles ]"
    try {
        Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True -ErrorAction Stop
        Write-Host "    - Firewall enabled for Domain, Public, Private profiles"
    }
    catch {
        $path = "HKLM:\SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\StandardProfile"
        Set-ItemProperty -Path $path -Name "EnableFirewall" -Value 1 -Type DWord -Force
        $value = Get-ItemProperty -Path $path -Name "EnableFirewall"
        Write-Host "    EnableFirewall (StandardProfile): $($value.EnableFirewall)"
    }
    Write-Host ""

    Write-Host "    [ Disable AutoRun for Removable Media ]"
    $path = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer"
    if (-not (Test-Path $path)) {
        New-Item -Path $path -Force | Out-Null
    }
    Set-ItemProperty -Path $path -Name "NoDriveTypeAutoRun" -Value 255 -Type DWord -Force
    $value = Get-ItemProperty -Path $path -Name "NoDriveTypeAutoRun"
    Write-Host "    NoDriveTypeAutoRun: $($value.NoDriveTypeAutoRun)"
    Write-Host ""

    Write-Host "    [ Disable Recovery Console Auto Logon ]"
    $path = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\setup\recoveryconsole"
    if (-not (Test-Path $path)) {
        New-Item -Path $path -Force | Out-Null
    }
    Set-ItemProperty -Path $path -Name "SecurityLevel" -Value 0 -Type DWord -Force
    $value = Get-ItemProperty -Path $path -Name "SecurityLevel"
    Write-Host "    SecurityLevel: $($value.SecurityLevel)"
    Write-Host ""

    Write-Host "    [ Delete Temp Internet Files on Exit ]"
    $path = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Internet Settings\Cache"
    Set-ItemProperty -Path $path -Name "Persistent" -Value 0 -Type DWord -Force
    $value = Get-ItemProperty -Path $path -Name "Persistent"
    Write-Host "    Persistent: $($value.Persistent)"
    Write-Host ""

    Write-Host "    [ Disable RDP ]"
    $path = "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server"
    Set-ItemProperty -Path $path -Name "fDenyTSConnections" -Value 1 -Type DWord -Force
    $value = Get-ItemProperty -Path $path -Name "fDenyTSConnections"
    Write-Host "    fDenyTSConnections: $($value.fDenyTSConnections)"
    Write-Host ""

    Write-Host "    [ Disable News and Interests ]"
    $path = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Feeds"
    if (-not (Test-Path $path)) {
        New-Item -Path $path -Force | Out-Null
    }
    Set-ItemProperty -Path $path -Name "EnableFeeds" -Value 0 -Type DWord -Force
    $value = Get-ItemProperty -Path $path -Name "EnableFeeds"
    Write-Host "    EnableFeeds: $($value.EnableFeeds)"
    Write-Host ""
}

function Disable-GuestAccount {
    Write-Host "    [ Disable Guest Account ]"
    try {
        $guest = Get-LocalUser -Name Guest -ErrorAction SilentlyContinue
        if ($guest -and $guest.Enabled) {
            Disable-LocalUser -Name Guest
            Write-Host "    - Guest account disabled"
        } else {
            Write-Host "    - Guest account is already disabled"
        }
    }
    catch {
        Write-Host "    [WARNING] Failed to disable Guest account: $_" -ForegroundColor Yellow
    }
    Write-Host ""
}

function Set-AuditPolicy {
    Write-Host "    [ Configure Audit Policy ]"

    $subcategories = @(
        @{ Name = "Logon";    GUID = "{0CCE9215-69AE-11D9-BED3-505054503030}" }
        @{ Name = "Logoff";   GUID = "{0CCE9216-69AE-11D9-BED3-505054503030}" }
        @{ Name = "Account Lockout"; GUID = "{0CCE9217-69AE-11D9-BED3-505054503030}" }
        @{ Name = "Account Logon";   GUID = "{0CCE9240-69AE-11D9-BED3-505054503030}" }
        @{ Name = "Credential Validation"; GUID = "{0CCE923F-69AE-11D9-BED3-505054503030}" }
    )

    foreach ($sub in $subcategories) {
        auditpol /set /subcategory:"$($sub.GUID)" /success:enable /failure:enable 2>&1 | Out-Null
        Write-Host "    - $($sub.Name): Success and Failure auditing enabled"
    }
    Write-Host ""
}

function Set-EventLogSize {
    Write-Host "    [ Set Security Event Log Size to 20MB ]"
    try {
        $logName = "Security"
        $log = Get-WinEvent -ListLog $logName -ErrorAction Stop
        $log.MaximumSizeInBytes = 20MB
        $log.SaveChanges()
        Write-Host "    - Security log max size: $($log.MaximumSizeInBytes / 1MB)MB"
    }
    catch {
        Write-Host "    [WARNING] Failed to set event log size: $_" -ForegroundColor Yellow
    }
    Write-Host ""
}

function Disable-SMBv1 {
    Write-Host "    [ Disable SMBv1 Protocol ]"
    try {
        $smb1 = (Get-SmbServerConfiguration -ErrorAction Stop).EnableSMB1Protocol
        if ($smb1) {
            Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force
            Write-Host "    - SMBv1 disabled"
        } else {
            Write-Host "    - SMBv1 is already disabled"
        }
    }
    catch {
        Write-Host "    [WARNING] Failed to configure SMBv1: $_" -ForegroundColor Yellow
    }
    Write-Host ""
}

function Enable-UAC {
    Write-Host "    [ Enable UAC ]"
    $path = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
    $current = (Get-ItemProperty -Path $path -Name "EnableLUA").EnableLUA
    if ($current -ne 1) {
        Set-ItemProperty -Path $path -Name "EnableLUA" -Value 1 -Type DWord -Force
        Write-Host "    - UAC enabled (restart required)"
    } else {
        Write-Host "    - UAC is already enabled"
    }
    Write-Host ""
}

function Set-PowerShellPolicy {
    Write-Host "    [ Set PowerShell Execution Policy to RemoteSigned ]"
    try {
        Set-ExecutionPolicy RemoteSigned -Force -Scope LocalMachine -ErrorAction Stop
    } catch {
        # Ignore override warning - LocalMachine policy is saved even if Process scope overrides it
    }
    $policy = Get-ExecutionPolicy -Scope LocalMachine
    Write-Host "    - ExecutionPolicy (LocalMachine): $policy"
    Write-Host ""
}

function Disable-WinRM {
    Write-Host "    [ Disable WinRM Service ]"
    try {
        $svc = Get-Service WinRM -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -eq 'Running') {
            Stop-Service WinRM -Force
            Set-Service WinRM -StartupType Disabled
            Write-Host "    - WinRM stopped and disabled"
        } elseif ($svc) {
            Set-Service WinRM -StartupType Disabled
            Write-Host "    - WinRM is not running, startup set to Disabled"
        } else {
            Write-Host "    - WinRM service not found"
        }
    }
    catch {
        Write-Host "    [WARNING] Failed to disable WinRM: $_" -ForegroundColor Yellow
    }
    Write-Host ""
}

function Invoke-WindowsUpdate {
    Write-Host ""
    $response = Read-Host "Run Windows Update? (y/n)"

    while ($response -notmatch '^[yn]$') {
        $response = Read-Host "Run Windows Update? (y/n)"
    }

    if ($response -eq 'y') {
        Write-Host ""
        Write-Host "Checking update module..."

        try {
            Install-Module PSWindowsUpdate -Force -ErrorAction Stop
            Set-ExecutionPolicy RemoteSigned -Force -Scope Process
            Import-Module PSWindowsUpdate

            Write-Host "      - Checking for updates..."
            Get-WindowsUpdate

            Install-WindowsUpdate -AcceptAll -IgnoreReboot

            Set-ExecutionPolicy Restricted -Force -Scope Process

            Write-Host ""
        }
        catch {
            Write-Host "[WARNING] Error during Windows Update: $_"
        }
    }
}

function Set-Hostname {
    Write-Host ""
    Write-Host "    [ Hostname Change ]"
    Write-Host "Current hostname: $env:COMPUTERNAME"

    $response = Read-Host "Change hostname? (y/n)"

    while ($response -notmatch '^[yn]$') {
        $response = Read-Host "Change hostname? (y/n)"
    }

    if ($response -eq 'y') {
        Write-Host ""
        $newHostname = Read-Host "Enter new hostname"

        try {
            Rename-Computer -NewName $newHostname -Force -ErrorAction Stop
            Write-Host "Hostname changed to $newHostname. Will apply after restart."
        }
        catch {
            throw "Hostname change failed: $_"
        }
        Write-Host ""
    }
}

function Set-UserName {
    Write-Host ""
    Write-Host "    [ Change User Account Name ]"
    Write-Host "Current username: $env:USERNAME"

    $response = Read-Host "Change username? (y/n)"

    while ($response -notmatch '^[yn]$') {
        $response = Read-Host "Change username? (y/n)"
    }

    if ($response -eq 'y') {
        Write-Host ""
        $newUser = Read-Host "Enter new username"

        try {
            Rename-LocalUser -Name $env:USERNAME -NewName $newUser -ErrorAction Stop
            Write-Host "Username changed to $newUser"
            $script:currentUser = $newUser
        }
        catch {
            throw "Username change failed: $_"
        }
        Write-Host ""
    }
    else {
        $script:currentUser = $env:USERNAME
    }
}

function Set-UserPassword {
    Write-Host ""
    Write-Host "    [ Change User Password ]"

    $targetUser = if ($script:currentUser) { $script:currentUser } else { $env:USERNAME }
    Write-Host "Target account: $targetUser"

    $response = Read-Host "Change password to default? (y/n)"

    while ($response -notmatch '^[yn]$') {
        $response = Read-Host "Change password to default? (y/n)"
    }

    if ($response -eq 'y') {
        Write-Host ""

        try {
            net user $targetUser "wavebridge1@#" | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Password change failed"
            }
            Write-Host "Password changed to wavebridge1@#"

            net user $targetUser /passwordreq:yes | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Password requirement setting failed"
            }
            Write-Host "Password requirement enabled"
        }
        catch {
            throw "Password setting failed: $_"
        }
        Write-Host ""
    }
}

function Set-NTPServer {
    Write-Host ""
    Write-Host "    [ NTP Server Configuration ]"

    $response = Read-Host "Configure NTP server? (y/n)"

    while ($response -notmatch '^[yn]$') {
        $response = Read-Host "Configure NTP server? (y/n)"
    }

    if ($response -eq 'y') {
        Write-Host ""

        Start-Service w32time -ErrorAction SilentlyContinue

        $ntpServer = Read-Host "Enter NTP server address"

        try {
            w32tm /config /manualpeerlist:$ntpServer /syncfromflags:manual /update | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "NTP configuration failed"
            }

            $source = w32tm /query /source
            Write-Host "NTP Server: $source"
            Write-Host "NTP server configuration completed"
        }
        catch {
            throw "NTP server configuration failed: $_"
        }
    }
}

function Invoke-Reboot {
    Write-Host ""
    Write-Host "========================================================"
    Write-Host "        PC Security Configuration Completed"
    Write-Host "========================================================"
    Write-Host "A restart is required to apply all settings."

    $response = Read-Host "Restart now? (y/n)"

    while ($response -notmatch '^[yn]$') {
        $response = Read-Host "Restart now? (y/n)"
    }

    if ($response -eq 'y') {
        Restart-Computer -Force
    }
}

#endregion

#region Main Script

try {
    Write-Header

    Disable-GuestAccount

    Set-PasswordPolicy

    Set-SecurityPolicy

    Set-AccountLockoutPolicy

    Set-ScreenSaver

    Set-RegistrySettings

    Set-AuditPolicy

    Set-EventLogSize

    Disable-SMBv1

    Enable-UAC

    Set-PowerShellPolicy

    Disable-WinRM

    Invoke-WindowsUpdate

    Set-Hostname

    Set-UserName

    Set-UserPassword

    Set-NTPServer

    Invoke-Reboot
}
catch {
    Write-Host ""
    Write-Host "[ERROR] An error occurred during processing."
    Write-Host "Details: $_"
    Read-Host "Press any key to exit"
}

Write-Host ""
Read-Host "Press any key to exit"

#endregion
