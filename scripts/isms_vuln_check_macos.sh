#!/bin/bash
# ============================================================================
# ISMS-P macOS Security Vulnerability Check Script
# For CrowdStrike Falcon RTR / Terminal
# ============================================================================
# Version: 3.0
# Description: macOS 보안 설정 확인 스크립트 (결과 파일 출력)
# Usage (Terminal): sudo bash isms_vuln_check_macos.sh
# Usage (RTR):      runscript -CloudFile="isms_vuln_check_macos"
# Result file saved in the same directory as this script
# ============================================================================

# --- Pre-flight Check ---
if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: This script must be run as root (use sudo)."
    exit 1
fi

# --- Setup ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
CURRENT_USER=$(stat -f %Su /dev/console)
TOTAL_CHECKS=0
VULN_COUNT=0
WARN_COUNT=0
PASS_COUNT=0
INFO_COUNT=0

# --- User name prompt ---
echo ""
printf "Enter your name: "
read -r USER_NAME
RESULT_FILE="${SCRIPT_DIR}/ISMS_VulnCheck_Result_${USER_NAME}_${TIMESTAMP}.txt"

# --- Helper functions ---
write_result() {
    echo "$1" >> "$RESULT_FILE"
}

add_pass() {
    write_result "[PASS] $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

add_vuln() {
    write_result "[VULN] $1"
    [ -n "$2" ] && write_result "  Fix: $2"
    VULN_COUNT=$((VULN_COUNT + 1))
}

add_warn() {
    write_result "[WARN] $1"
    [ -n "$2" ] && write_result "  Fix: $2"
    WARN_COUNT=$((WARN_COUNT + 1))
}

add_info() {
    write_result "[INFO] $1"
    INFO_COUNT=$((INFO_COUNT + 1))
}

# --- Header ---
OS_VERSION=$(sw_vers -productVersion 2>/dev/null || echo "Unknown")
OS_BUILD=$(sw_vers -buildVersion 2>/dev/null || echo "Unknown")

write_result "============================================================================"
write_result " ISMS-P macOS Vulnerability Check Report"
write_result "============================================================================"
write_result ""
write_result " Date: $(date '+%Y-%m-%d %H:%M:%S')"
write_result " Inspector: $USER_NAME"
write_result " Hostname: $(hostname)"
write_result " Console User: $CURRENT_USER"
write_result " OS: macOS $OS_VERSION ($OS_BUILD)"
write_result ""
write_result " Standard: ISMS-P Certification [Korea Information Security Management System]"
write_result " Controls: 2.5[Auth], 2.6[Access], 2.9[Ops], 2.10[Security], 2.11[Incident]"
write_result " Severity: VULN[Critical] / WARN[Warning] / PASS[Good] / INFO[Reference]"
write_result "============================================================================"
write_result ""

echo "========================================================="
echo " ISMS-P macOS Vulnerability Check Starting..."
echo " Result file: $RESULT_FILE"
echo "========================================================="
echo ""

# ============================================================================
# SECTION 1: Account Management [ISMS 2.5]
# ============================================================================
echo "[1/7] Checking Account Management..."
write_result "============================================================================"
write_result " [1] Account Management [ISMS 2.5]"
write_result "============================================================================"
write_result ""

# 1.1 Guest account
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [1.1] Guest Account Disabled [ISMS 2.5.1] ---"
guest_status=$(dscl . -read /Users/Guest AuthenticationAuthority 2>/dev/null)
guest_shell=$(dscl . -read /Users/Guest UserShell 2>/dev/null | awk '{print $2}')
if echo "$guest_status" | grep -qi "DisabledUser" || [ "$guest_shell" = "/usr/bin/false" ]; then
    add_pass "Guest account is disabled."
else
    guest_enabled=$(defaults read /Library/Preferences/com.apple.loginwindow GuestEnabled 2>/dev/null)
    if [ "$guest_enabled" = "0" ] || [ -z "$guest_enabled" ]; then
        add_pass "Guest account is disabled."
    else
        add_vuln "Guest account is ENABLED." "Disable Guest in System Preferences - Users & Groups"
    fi
fi
write_result ""

# 1.2 Auto Login
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [1.2] Auto Login Disabled [ISMS 2.5.1] ---"
login_user=$(defaults read /Library/Preferences/com.apple.loginwindow autoLoginUser 2>/dev/null)
if [ -z "$login_user" ]; then
    add_pass "Auto Login is disabled."
else
    add_vuln "Auto Login is ENABLED for user: $login_user" "Disable in System Preferences - Users & Groups - Login Options"
fi
write_result ""

# 1.3 Login Window Display
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [1.3] Login Window Shows Name and Password [ISMS 2.5.3] ---"
show_fullname=$(defaults read /Library/Preferences/com.apple.loginwindow SHOWFULLNAME 2>/dev/null)
if [ "$show_fullname" = "1" ]; then
    add_pass "Login window shows name and password fields."
else
    add_warn "Login window shows user list (Value: ${show_fullname:-not set})" "Set to Name and Password in System Preferences - Users & Groups - Login Options"
fi
write_result ""

# 1.4 Local accounts list
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [1.4] Local Account List [ISMS 2.5.1] ---"
add_info "Registered local accounts [review for unnecessary ones]:"
for user in $(dscl . -list /Users | grep -v '^_'); do
    uid=$(dscl . -read "/Users/$user" UniqueID 2>/dev/null | awk '{print $2}')
    if [ -n "$uid" ] && [ "$uid" -ge 200 ] 2>/dev/null; then
        write_result "  $user [UID=$uid]"
    fi
done
write_result ""

# ============================================================================
# SECTION 2: Password Policy [ISMS 2.5.4]
# ============================================================================
echo "[2/7] Checking Password Policy..."
write_result "============================================================================"
write_result " [2] Password Policy [ISMS 2.5.4]"
write_result "============================================================================"
write_result ""

# 2.1 Password policy settings
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [2.1] Password Policy Configuration ---"
policy=$(pwpolicy -getglobalpolicy 2>/dev/null)
if [ -n "$policy" ]; then
    min_chars=$(echo "$policy" | grep -oE "minChars=[0-9]+" | cut -d= -f2)
    req_alpha=$(echo "$policy" | grep -oE "requiresAlpha=[0-9]+" | cut -d= -f2)
    req_num=$(echo "$policy" | grep -oE "requiresNumeric=[0-9]+" | cut -d= -f2)
    use_history=$(echo "$policy" | grep -oE "usingHistory=[0-9]+" | cut -d= -f2)
    max_age=$(echo "$policy" | grep -oE "maxMinutesUntilChangePassword=[0-9]+" | cut -d= -f2)
    max_failed=$(echo "$policy" | grep -oE "maxFailedLoginAttempts=[0-9]+" | cut -d= -f2)

    write_result "  minChars: ${min_chars:-not set} (Target: >= 8)"
    write_result "  requiresAlpha: ${req_alpha:-not set} (Target: 1)"
    write_result "  requiresNumeric: ${req_num:-not set} (Target: 1)"
    write_result "  usingHistory: ${use_history:-not set} (Target: >= 12)"
    write_result "  maxMinutesUntilChangePassword: ${max_age:-not set} (Target: <= 129600 = 90 days)"
    write_result "  maxFailedLoginAttempts: ${max_failed:-not set} (Target: <= 5)"

    pw_pass=true
    [ "${min_chars:-0}" -lt 8 ] && pw_pass=false && write_result "  -> [VULN] minChars < 8"
    [ "${req_alpha:-0}" -ne 1 ] && pw_pass=false && write_result "  -> [VULN] requiresAlpha != 1"
    [ "${req_num:-0}" -ne 1 ] && pw_pass=false && write_result "  -> [VULN] requiresNumeric != 1"
    [ -z "$max_age" ] && pw_pass=false && write_result "  -> [VULN] maxMinutesUntilChangePassword not set"

    if $pw_pass; then
        add_pass "Password policy is correctly configured."
    else
        add_vuln "Password policy has issues (see above)." "Configure via pwpolicy or MDM profile"
    fi
else
    add_vuln "Unable to retrieve password policy (not configured)." "Configure password policy via pwpolicy or MDM profile"
fi
write_result ""

# ============================================================================
# SECTION 3: Services and Network [ISMS 2.6, 2.10]
# ============================================================================
echo "[3/7] Checking Services and Network..."
write_result "============================================================================"
write_result " [3] Services and Network [ISMS 2.6, 2.10]"
write_result "============================================================================"
write_result ""

# 3.1 SSH (Remote Login)
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [3.1] SSH / Remote Login [ISMS 2.6.6] ---"
ssh_status=$(sudo systemsetup -getremotelogin 2>/dev/null)
if echo "$ssh_status" | grep -qi "off"; then
    add_pass "SSH (Remote Login) is Off."
else
    add_warn "SSH (Remote Login) is On." "Disable in System Preferences - Sharing, or: sudo systemsetup -setremotelogin off"
fi
write_result ""

# 3.2 ARD (Apple Remote Desktop)
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [3.2] Apple Remote Desktop [ISMS 2.6.6] ---"
ard_process=$(ps aux | grep ARDAgent | grep -v grep)
if [ -z "$ard_process" ]; then
    add_pass "ARDAgent is not running."
else
    add_warn "ARDAgent is running." "Disable in System Preferences - Sharing - Remote Management"
fi
write_result ""

# 3.3 Firewall
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [3.3] Application Firewall [ISMS 2.6.1] ---"
fw_state=$(/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null)
if echo "$fw_state" | grep -q "enabled"; then
    add_pass "Application Firewall is enabled."
else
    add_vuln "Application Firewall is DISABLED." "Enable in System Preferences - Security & Privacy - Firewall"
fi
write_result ""

# 3.4 Stealth Mode
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [3.4] Firewall Stealth Mode [ISMS 2.6.1] ---"
stealth_state=$(/usr/libexec/ApplicationFirewall/socketfilterfw --getstealthmode 2>/dev/null)
if echo "$stealth_state" | grep -q "enabled"; then
    add_pass "Stealth Mode is enabled."
else
    add_warn "Stealth Mode is disabled." "Enable: /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on"
fi
write_result ""

# 3.5 AirDrop
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [3.5] AirDrop Disabled [ISMS 2.10.7] ---"
airdrop_disabled=$(sudo -u "$CURRENT_USER" defaults read com.apple.NetworkBrowser DisableAirDrop 2>/dev/null)
if [ "$airdrop_disabled" = "1" ]; then
    add_pass "AirDrop is disabled."
else
    add_warn "AirDrop is not disabled (Value: ${airdrop_disabled:-not set})." "Disable AirDrop or set to Contacts Only"
fi
write_result ""

# ============================================================================
# SECTION 4: Patch Management [ISMS 2.10.8]
# ============================================================================
echo "[4/7] Checking Patches..."
write_result "============================================================================"
write_result " [4] Patch Management [ISMS 2.10.8, 2.10.9]"
write_result "============================================================================"
write_result ""

# 4.1 Software Update Settings
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [4.1] Software Update Settings ---"
auto_check=$(defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled 2>/dev/null)
auto_download=$(defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload 2>/dev/null)
critical_update=$(defaults read /Library/Preferences/com.apple.SoftwareUpdate CriticalUpdateInstall 2>/dev/null)

write_result "  AutomaticCheckEnabled: ${auto_check:-not set} (Target: 1)"
write_result "  AutomaticDownload: ${auto_download:-not set} (Target: 1)"
write_result "  CriticalUpdateInstall: ${critical_update:-not set} (Target: 1)"

su_pass=true
[ "${auto_check:-0}" != "1" ] && su_pass=false && write_result "  -> [VULN] AutomaticCheckEnabled != 1"
[ "${auto_download:-0}" != "1" ] && su_pass=false && write_result "  -> [WARN] AutomaticDownload != 1"
[ "${critical_update:-0}" != "1" ] && su_pass=false && write_result "  -> [VULN] CriticalUpdateInstall != 1"

if $su_pass; then
    add_pass "Software Update settings are correctly configured."
else
    add_vuln "Software Update settings need attention (see above)." "Enable in System Preferences - Software Update"
fi
write_result ""

# 4.2 Last update check
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [4.2] Recent Software Updates ---"
add_info "Last 10 installed updates:"
softwareupdate --history 2>/dev/null | head -12 | while IFS= read -r line; do
    write_result "  $line"
done
write_result ""

# ============================================================================
# SECTION 5: Audit and Logging [ISMS 2.9.4/2.9.5]
# ============================================================================
echo "[5/7] Checking Audit Policy..."
write_result "============================================================================"
write_result " [5] Audit and Logging [ISMS 2.9.4, 2.9.5]"
write_result "============================================================================"
write_result ""

# 5.1 OpenBSM audit
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [5.1] OpenBSM Audit Service ---"
audit_running=$(launchctl list 2>/dev/null | grep auditd)
if [ -n "$audit_running" ]; then
    add_pass "OpenBSM audit daemon (auditd) is running."
else
    add_vuln "OpenBSM audit daemon (auditd) is NOT running." "Enable: sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.auditd.plist"
fi
write_result ""

# 5.2 Audit flags
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [5.2] Audit Flags Configuration ---"
if [ -f /etc/security/audit_control ]; then
    flags=$(grep "^flags:" /etc/security/audit_control 2>/dev/null | cut -d: -f2)
    write_result "  Audit flags: ${flags:-not set}"
    if echo "$flags" | grep -q "lo"; then
        add_pass "Login/logout auditing is configured."
    else
        add_warn "Login/logout auditing may not be configured." "Add 'lo' to flags in /etc/security/audit_control"
    fi
else
    add_warn "Audit control file not found." "Check /etc/security/audit_control"
fi
write_result ""

# 5.3 Install.log and system.log
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [5.3] System Log Availability ---"
log_pass=true
if [ -f /var/log/install.log ]; then
    write_result "  install.log: exists"
else
    write_result "  install.log: NOT found"
    log_pass=false
fi
if [ -d /var/log ]; then
    write_result "  /var/log directory: exists"
else
    write_result "  /var/log directory: NOT found"
    log_pass=false
fi
if $log_pass; then
    add_pass "System logs are available."
else
    add_warn "Some system logs are missing." "Verify log rotation and storage"
fi
write_result ""

# ============================================================================
# SECTION 6: Security Settings [ISMS 2.7, 2.10]
# ============================================================================
echo "[6/7] Checking Security Settings..."
write_result "============================================================================"
write_result " [6] Security Settings [ISMS 2.7, 2.10, 2.11]"
write_result "============================================================================"
write_result ""

# 6.1 Screensaver Lock
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [6.1] Screen Saver Lock ---"
idle_time=$(sudo -u "$CURRENT_USER" defaults -currentHost read com.apple.screensaver idleTime 2>/dev/null)
ask_pass=$(sudo -u "$CURRENT_USER" defaults -currentHost read com.apple.screensaver askForPassword 2>/dev/null)
ask_delay=$(sudo -u "$CURRENT_USER" defaults -currentHost read com.apple.screensaver askForPasswordDelay 2>/dev/null)

write_result "  Idle Time (Seconds): ${idle_time:-not set} (Target: <= 600)"
write_result "  Ask Password: ${ask_pass:-not set} (Target: 1)"
write_result "  Ask Password Delay: ${ask_delay:-not set} (Target: 0)"

ss_pass=true
if [ -z "$idle_time" ]; then
    ss_pass=false
    write_result "  -> [VULN] idleTime not set"
elif [ "$idle_time" -gt 600 ] 2>/dev/null; then
    ss_pass=false
    write_result "  -> [WARN] idleTime > 600 seconds"
fi
if [ "${ask_pass:-0}" != "1" ]; then
    ss_pass=false
    write_result "  -> [VULN] askForPassword != 1"
fi

if $ss_pass; then
    add_pass "Screensaver lock is correctly configured."
else
    add_vuln "Screensaver settings need attention (see above)." "Set in System Preferences - Desktop & Screen Saver / Security & Privacy"
fi
write_result ""

# 6.2 Display Sleep
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [6.2] Display Sleep Settings ---"
add_info "Power management display sleep settings:"
pmset -g custom 2>/dev/null | grep -E "Battery Power|AC Power|displaysleep" | while IFS= read -r line; do
    write_result "  $line"
done
write_result ""

# 6.3 FileVault (Disk Encryption)
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [6.3] FileVault Encryption [ISMS 2.7.1] ---"
fv_status=$(fdesetup status 2>/dev/null)
if echo "$fv_status" | grep -q "On"; then
    add_pass "FileVault is enabled. ($fv_status)"
else
    add_vuln "FileVault is NOT enabled. ($fv_status)" "Enable FileVault in System Preferences - Security & Privacy"
fi
write_result ""

# 6.4 SIP (System Integrity Protection)
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [6.4] System Integrity Protection (SIP) ---"
sip_status=$(csrutil status 2>/dev/null)
if echo "$sip_status" | grep -q "enabled"; then
    add_pass "SIP is enabled. ($sip_status)"
else
    add_vuln "SIP is DISABLED. ($sip_status)" "Boot to Recovery Mode and run: csrutil enable"
fi
write_result ""

# 6.5 Gatekeeper
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [6.5] Gatekeeper [ISMS 2.10.9] ---"
gk_status=$(spctl --status 2>/dev/null)
if echo "$gk_status" | grep -q "enabled"; then
    add_pass "Gatekeeper is enabled."
else
    add_vuln "Gatekeeper is DISABLED." "Enable: sudo spctl --master-enable"
fi
write_result ""

# 6.6 XProtect (Antivirus)
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [6.6] XProtect / Malware Removal Tool [ISMS 2.10.9] ---"
xprotect_meta=$(system_profiler SPInstallHistoryDataType 2>/dev/null | grep -A1 "XProtect" | tail -1 | xargs)
mrt_meta=$(system_profiler SPInstallHistoryDataType 2>/dev/null | grep -A1 "MRTConfigData" | tail -1 | xargs)
if [ -d "/Library/Apple/System/Library/CoreServices/XProtect.bundle" ]; then
    add_pass "XProtect bundle is present."
    [ -n "$xprotect_meta" ] && write_result "  Last XProtect update: $xprotect_meta"
else
    add_warn "XProtect bundle not found." "Ensure macOS security updates are installed"
fi
write_result ""

# ============================================================================
# SECTION 7: Additional [ISMS 2.9, 2.11]
# ============================================================================
echo "[7/7] Additional Checks..."
write_result "============================================================================"
write_result " [7] Additional Security [ISMS 2.9, 2.11]"
write_result "============================================================================"
write_result ""

# 7.1 Bluetooth sharing
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [7.1] Bluetooth Sharing [ISMS 2.10.7] ---"
bt_sharing=$(defaults read /Library/Preferences/com.apple.Bluetooth PrefKeyServicesEnabled 2>/dev/null)
if [ "$bt_sharing" = "0" ] || [ -z "$bt_sharing" ]; then
    add_pass "Bluetooth sharing is disabled."
else
    add_warn "Bluetooth sharing is enabled." "Disable in System Preferences - Sharing"
fi
write_result ""

# 7.2 Internet Sharing
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [7.2] Internet Sharing ---"
internet_sharing=$(defaults read /Library/Preferences/SystemConfiguration/com.apple.nat NAT 2>/dev/null | grep -c "Enabled = 1")
if [ "$internet_sharing" = "0" ] || [ -z "$internet_sharing" ]; then
    add_pass "Internet Sharing is disabled."
else
    add_warn "Internet Sharing is enabled." "Disable in System Preferences - Sharing"
fi
write_result ""

# 7.3 NTP (Time Synchronization)
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [7.3] Time Synchronization / NTP [ISMS 2.9.6] ---"
ntp_enabled=$(sudo systemsetup -getusingnetworktime 2>/dev/null)
if echo "$ntp_enabled" | grep -qi "on"; then
    add_pass "Network Time synchronization is enabled."
else
    add_warn "Network Time synchronization is OFF." "Enable: sudo systemsetup -setusingnetworktime on"
fi
write_result ""

# 7.4 Remote Apple Events
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [7.4] Remote Apple Events [ISMS 2.6.6] ---"
rae_status=$(sudo systemsetup -getremoteappleevents 2>/dev/null)
if echo "$rae_status" | grep -qi "off"; then
    add_pass "Remote Apple Events is Off."
else
    add_warn "Remote Apple Events is On." "Disable: sudo systemsetup -setremoteappleevents off"
fi
write_result ""

# 7.5 Firmware Password (Intel) / Secure Boot (Apple Silicon)
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [7.5] Boot Security ---"
arch=$(uname -m)
if [ "$arch" = "arm64" ]; then
    # Apple Silicon - check Secure Boot via bputil (may require authentication)
    add_info "Apple Silicon detected. Secure Boot is enforced by default."
    write_result "  Architecture: Apple Silicon ($arch)"
else
    # Intel - check firmware password
    fw_pass=$(firmwarepasswd -check 2>/dev/null)
    if echo "$fw_pass" | grep -qi "Yes"; then
        add_pass "Firmware password is set."
    else
        add_warn "Firmware password is NOT set." "Set via: sudo firmwarepasswd -setpasswd"
    fi
fi
write_result ""

# 7.6 Hosts file integrity
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [7.6] Hosts File Integrity ---"
SAFE_PATTERNS="localhost|broadcasthost|docker\.internal|kubernetes\.docker\.internal|host\.docker\.internal"
suspicious_found=false
while IFS= read -r line; do
    trimmed=$(echo "$line" | sed 's/^[[:space:]]*//')
    [ -z "$trimmed" ] && continue
    echo "$trimmed" | grep -q "^#" && continue
    if ! echo "$trimmed" | grep -qE "$SAFE_PATTERNS"; then
        write_result "  [!] $trimmed"
        suspicious_found=true
    fi
done < /etc/hosts 2>/dev/null

if $suspicious_found; then
    add_warn "Unexpected entries in hosts file." "Review /etc/hosts"
else
    add_pass "No suspicious entries in hosts file."
fi
write_result ""

# ============================================================================
# SUMMARY
# ============================================================================
if [ "$TOTAL_CHECKS" -gt 0 ]; then
    TOTAL_SCORE=$(( PASS_COUNT * 100 / TOTAL_CHECKS ))
else
    TOTAL_SCORE=0
fi

write_result "============================================================================"
write_result " SUMMARY"
write_result "============================================================================"
write_result ""
write_result " Total checks:    $TOTAL_CHECKS"
write_result " --------------------------------"
write_result " [VULN] Critical: $VULN_COUNT"
write_result " [WARN] Warning:  $WARN_COUNT"
write_result " [PASS] Good:     $PASS_COUNT"
write_result " [INFO] Info:     $INFO_COUNT"
write_result " --------------------------------"
write_result " Security Score:  ~${TOTAL_SCORE}%"
write_result ""

if [ "$VULN_COUNT" -gt 0 ]; then
    write_result " [!] $VULN_COUNT critical issues found. Immediate action required."
fi
if [ "$WARN_COUNT" -gt 0 ]; then
    write_result " [*] $WARN_COUNT warnings found. Improvement recommended."
fi

write_result ""
write_result "============================================================================"
write_result " ISMS-P Control Mapping"
write_result "============================================================================"
write_result ""
write_result " 2.5.1 User Account Mgmt       - Checks 1.1~1.4"
write_result " 2.5.3 User Authentication     - Check 1.3"
write_result " 2.5.4 Password Management     - Check 2.1"
write_result " 2.6.1 Network Access Control  - Checks 3.3, 3.4"
write_result " 2.6.6 Remote Access Control   - Checks 3.1, 3.2, 7.4"
write_result " 2.7.1 Encryption Policy       - Check 6.3"
write_result " 2.9.4 Log Management          - Checks 5.1~5.3"
write_result " 2.9.5 Log Review              - Check 5.2"
write_result " 2.9.6 Time Synchronization    - Check 7.3"
write_result " 2.10.7 Removable Media        - Checks 3.5, 7.1"
write_result " 2.10.8 Patch Management       - Checks 4.1, 4.2"
write_result " 2.10.9 Malware Control        - Checks 6.5, 6.6"
write_result " 2.11.2 Vulnerability Check    - This entire script"
write_result ""
write_result "============================================================================"
write_result " End of Report"
write_result "============================================================================"

# --- Done ---
echo ""
echo "========================================================="
echo " Scan Complete!"
echo ""
echo " Total: $TOTAL_CHECKS checks"
echo " VULN: $VULN_COUNT  WARN: $WARN_COUNT  PASS: $PASS_COUNT  INFO: $INFO_COUNT"
echo ""
echo " Result: $RESULT_FILE"
echo "========================================================="
echo ""
