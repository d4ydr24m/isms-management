#!/bin/bash
# ============================================================================
# ISMS-P macOS Vulnerability Check Script
# Usage: Double-click or run in Terminal: bash isms_vuln_check_macos.sh
# Result file saved in the same directory as this script
# ============================================================================

# --- Admin check ---
if [ "$EUID" -ne 0 ]; then
    echo "Requesting administrator privileges..."
    SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
    osascript -e "do shell script \"bash '$SCRIPT_PATH'\" with administrator privileges"
    exit 0
fi

# --- Setup ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

# Prompt for user name
echo ""
printf "Enter your name: "
read USER_NAME

RESULT_FILE="${SCRIPT_DIR}/ISMS_VulnCheck_Result_${USER_NAME}_${TIMESTAMP}.txt"

TOTAL_CHECKS=0
VULN_COUNT=0
WARN_COUNT=0
PASS_COUNT=0
INFO_COUNT=0

# Helper functions
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
OS_NAME=$(sw_vers -productName 2>/dev/null || echo "macOS")
HOSTNAME=$(scutil --get ComputerName 2>/dev/null || hostname)
CURRENT_USER=$(stat -f '%Su' /dev/console 2>/dev/null || echo "$USER")

write_result "============================================================================"
write_result " ISMS-P macOS Vulnerability Check Report"
write_result "============================================================================"
write_result ""
write_result " Date: $(date '+%Y-%m-%d %H:%M:%S')"
write_result " Inspector: $USER_NAME"
write_result " Computer: $HOSTNAME"
write_result " User: $CURRENT_USER"
write_result " OS: $OS_NAME $OS_VERSION ($OS_BUILD)"
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
GUEST_STATUS=$(defaults read /Library/Preferences/com.apple.loginwindow GuestEnabled 2>/dev/null)
if [ "$GUEST_STATUS" = "0" ] || [ -z "$GUEST_STATUS" ]; then
    add_pass "Guest account is disabled."
else
    add_vuln "Guest account is ENABLED." "System Settings > Users & Groups > Guest User > disable"
fi
write_result ""

# 1.2 Local accounts list
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [1.2] Local Account List [ISMS 2.5.1] ---"
add_info "Registered local accounts [review for unnecessary ones]:"
dscl . list /Users | grep -v '^_' | grep -v '^daemon$' | grep -v '^nobody$' | while read -r acct; do
    ADMIN_CHECK=$(dsmemberutil checkmembership -U "$acct" -G admin 2>/dev/null)
    if echo "$ADMIN_CHECK" | grep -q "is a member"; then
        write_result "  $acct [Admin]"
    else
        write_result "  $acct [Standard]"
    fi
done
write_result ""

# 1.3 Auto-login disabled
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [1.3] Auto-Login Disabled [ISMS 2.5.3] ---"
AUTO_LOGIN=$(defaults read /Library/Preferences/com.apple.loginwindow autoLoginUser 2>/dev/null)
if [ -z "$AUTO_LOGIN" ]; then
    add_pass "Auto-login is disabled."
else
    add_vuln "Auto-login is enabled for: $AUTO_LOGIN" "System Settings > Users & Groups > Login Options > disable auto-login"
fi
write_result ""

# 1.4 Login window shows name and password fields
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [1.4] Login Window Shows Name and Password [ISMS 2.5.3] ---"
LOGIN_DISPLAY=$(defaults read /Library/Preferences/com.apple.loginwindow SHOWFULLNAME 2>/dev/null)
if [ "$LOGIN_DISPLAY" = "1" ]; then
    add_pass "Login window shows name and password fields [no user list]."
else
    add_warn "Login window shows user list." "System Settings > Lock Screen > Login window shows: Name and password"
fi
write_result ""

# ============================================================================
# SECTION 2: Password Policy [ISMS 2.5.4]
# ============================================================================
echo "[2/7] Checking Password Policy..."
write_result "============================================================================"
write_result " [2] Password Policy [ISMS 2.5.4]"
write_result "============================================================================"
write_result ""

# Get password policy
PWPOLICY=$(pwpolicy -getaccountpolicies 2>/dev/null)

# 2.1 Password length
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [2.1] Minimum Password Length ---"
MIN_LEN=$(echo "$PWPOLICY" | grep -o 'policyAttributePassword matches .*(.\{[0-9]*,\})' | grep -o '[0-9]*' | head -1)
if [ -z "$MIN_LEN" ]; then
    # Try alternative method
    MIN_LEN=$(pwpolicy -getglobalpolicy 2>/dev/null | grep -o 'minChars=[0-9]*' | cut -d= -f2)
fi
if [ -n "$MIN_LEN" ] && [ "$MIN_LEN" -ge 8 ] 2>/dev/null; then
    add_pass "Min password length: $MIN_LEN chars [8+ OK]"
else
    add_warn "Min password length policy not detected or below 8." "Set via Configuration Profile or pwpolicy"
fi
write_result ""

# 2.2 Password complexity
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [2.2] Password Complexity ---"
if echo "$PWPOLICY" | grep -qi "requiresAlpha\|requiresNumeric\|requiresMixedCase\|policyAttributePassword matches"; then
    add_pass "Password complexity policy is configured."
else
    add_warn "Password complexity policy not detected." "Configure via Configuration Profile or MDM"
fi
write_result ""

# 2.3 Max password age
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [2.3] Maximum Password Age ---"
MAX_AGE=$(echo "$PWPOLICY" | grep -o 'maxPwdAge=[0-9]*' | cut -d= -f2 2>/dev/null)
if [ -z "$MAX_AGE" ]; then
    MAX_AGE_DAYS=$(echo "$PWPOLICY" | grep -o 'policyAttributeCurrentTime.*policyAttributeLastPasswordChangeTime.*[0-9]*' | grep -o '[0-9]*$' | head -1)
    if [ -n "$MAX_AGE_DAYS" ]; then
        MAX_AGE=$((MAX_AGE_DAYS / 86400))
    fi
fi
if [ -n "$MAX_AGE" ] && [ "$MAX_AGE" -gt 0 ] && [ "$MAX_AGE" -le 90 ] 2>/dev/null; then
    add_pass "Max password age: $MAX_AGE days [90 or less OK]"
else
    add_warn "Max password age policy not detected or unlimited." "Configure password expiration via Configuration Profile"
fi
write_result ""

# 2.4 Account lockout
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [2.4] Account Lockout ---"
MAX_FAILED=$(echo "$PWPOLICY" | grep -o 'maxFailedLoginAttempts=[0-9]*' | cut -d= -f2 2>/dev/null)
if [ -z "$MAX_FAILED" ]; then
    MAX_FAILED=$(echo "$PWPOLICY" | grep -o 'policyAttributeFailedAuthentications.*[<>].*[0-9]*' | grep -o '[0-9]*$' | head -1)
fi
if [ -n "$MAX_FAILED" ] && [ "$MAX_FAILED" -ge 1 ] && [ "$MAX_FAILED" -le 10 ] 2>/dev/null; then
    add_pass "Account lockout: $MAX_FAILED attempts"
else
    add_warn "Account lockout policy not detected." "Configure via Configuration Profile or pwpolicy"
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

# 3.1 Remote Login (SSH)
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [3.1] Remote Login / SSH [ISMS 2.6.6] ---"
SSH_STATUS=$(systemsetup -getremotelogin 2>/dev/null | grep -i "on")
if [ -z "$SSH_STATUS" ]; then
    add_pass "Remote Login (SSH) is disabled."
else
    add_warn "Remote Login (SSH) is enabled." "System Settings > General > Sharing > disable Remote Login"
fi
write_result ""

# 3.2 Screen Sharing / VNC
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [3.2] Screen Sharing [ISMS 2.6.6] ---"
SCREEN_SHARING=$(launchctl list 2>/dev/null | grep -c "com.apple.screensharing")
if [ "$SCREEN_SHARING" -eq 0 ]; then
    add_pass "Screen Sharing is disabled."
else
    add_warn "Screen Sharing is enabled." "System Settings > General > Sharing > disable Screen Sharing"
fi
write_result ""

# 3.3 File Sharing (SMB/AFP)
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [3.3] File Sharing [ISMS 2.6.1] ---"
FILE_SHARING=$(launchctl list 2>/dev/null | grep -c "com.apple.smbd")
if [ "$FILE_SHARING" -eq 0 ]; then
    add_pass "File Sharing (SMB) is disabled."
else
    add_warn "File Sharing (SMB) is enabled." "System Settings > General > Sharing > disable File Sharing"
fi
write_result ""

# 3.4 Firewall
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [3.4] macOS Firewall [ISMS 2.6.1] ---"
FW_STATUS=$(/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null)
if echo "$FW_STATUS" | grep -qi "enabled"; then
    add_pass "macOS Firewall is enabled."
    # Check stealth mode
    STEALTH=$(/usr/libexec/ApplicationFirewall/socketfilterfw --getstealthmode 2>/dev/null)
    if echo "$STEALTH" | grep -qi "enabled"; then
        write_result "  [INFO] Stealth mode is enabled."
    else
        write_result "  [INFO] Stealth mode is disabled. Consider enabling for extra protection."
    fi
else
    add_vuln "macOS Firewall is DISABLED." "System Settings > Network > Firewall > enable"
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

# 4.1 Software updates
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [4.1] Available Software Updates ---"
add_info "Checking for available updates..."
UPDATES=$(softwareupdate -l 2>&1)
if echo "$UPDATES" | grep -qi "No new software available"; then
    write_result "  No pending updates."
else
    write_result "  Available updates:"
    echo "$UPDATES" | grep -E '^\s+\*|Label:' | head -10 | while read -r line; do
        write_result "  $line"
    done
fi
write_result ""

# 4.2 Auto-update
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [4.2] Automatic Update Setting ---"
AUTO_CHECK=$(defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled 2>/dev/null)
AUTO_DOWNLOAD=$(defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload 2>/dev/null)
AUTO_INSTALL=$(defaults read /Library/Preferences/com.apple.commerce AutoUpdate 2>/dev/null)
if [ "$AUTO_CHECK" = "1" ]; then
    add_pass "Automatic update checking is enabled."
else
    add_warn "Automatic update checking is disabled." "System Settings > General > Software Update > enable automatic checks"
fi
write_result ""

# ============================================================================
# SECTION 5: Audit and Logging [ISMS 2.9.4/2.9.5]
# ============================================================================
echo "[5/7] Checking Audit Policy..."
write_result "============================================================================"
write_result " [5] Audit and Logging [ISMS 2.9.4, 2.9.5]"
write_result "============================================================================"
write_result ""

# 5.1 Audit status
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [5.1] Audit / Logging Status ---"
AUDIT_RUNNING=$(launchctl list 2>/dev/null | grep -c "com.apple.auditd")
if [ "$AUDIT_RUNNING" -gt 0 ]; then
    add_pass "OpenBSM audit daemon (auditd) is running."
    add_info "Audit flags:"
    AUDIT_FLAGS=$(grep "^flags:" /etc/security/audit_control 2>/dev/null)
    write_result "  $AUDIT_FLAGS"
else
    add_warn "OpenBSM audit daemon is not running." "Enable with: sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.auditd.plist"
fi
write_result ""

# 5.2 Install.log / system log
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [5.2] System Logging ---"
if [ -f /var/log/install.log ] && [ -f /var/log/system.log ] 2>/dev/null || log show --last 1m >/dev/null 2>&1; then
    add_pass "Unified logging system is active."
else
    add_warn "System logging may not be properly configured."
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

# 6.1 Screen saver / screen lock
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [6.1] Screen Lock ---"
SCREEN_LOCK_DELAY=$(sysadminctl -screenLock status 2>/dev/null | grep -o '[0-9]*' | head -1)
ASK_FOR_PW=$(defaults read com.apple.screensaver askForPassword 2>/dev/null)
ASK_FOR_PW_DELAY=$(defaults read com.apple.screensaver askForPasswordDelay 2>/dev/null)

if [ "$ASK_FOR_PW" = "1" ]; then
    DELAY_SEC=${ASK_FOR_PW_DELAY:-0}
    DELAY_MIN=$((DELAY_SEC / 60))
    if [ "$DELAY_SEC" -le 300 ]; then
        add_pass "Screen lock requires password [delay: ${DELAY_SEC}s]"
    else
        add_warn "Screen lock password delay: ${DELAY_MIN}min [over 5 min]" "System Settings > Lock Screen > Require password: immediately or short delay"
    fi
else
    add_vuln "Screen lock does NOT require password." "System Settings > Lock Screen > Require password after screen saver begins"
fi
write_result ""

# 6.2 FileVault (disk encryption)
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [6.2] FileVault Disk Encryption [ISMS 2.7.1] ---"
FV_STATUS=$(fdesetup status 2>/dev/null)
if echo "$FV_STATUS" | grep -qi "on"; then
    add_pass "FileVault disk encryption is enabled."
else
    add_warn "FileVault is NOT enabled." "System Settings > Privacy & Security > FileVault > Turn On"
fi
write_result ""

# 6.3 Antivirus / XProtect
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [6.3] Antivirus / Malware Protection [ISMS 2.10.9] ---"
AV_FOUND=false

# Check for 3rd-party AV
for av_name in "CrowdStrike" "Falcon" "Symantec" "McAfee" "Sophos" "ESET" "Kaspersky" "Bitdefender" "SentinelOne" "Carbon Black"; do
    if pgrep -fi "$av_name" >/dev/null 2>&1 || find /Applications -maxdepth 2 -name "*${av_name}*" 2>/dev/null | grep -q .; then
        add_pass "3rd-party AV detected: $av_name"
        AV_FOUND=true
        break
    fi
done

if [ "$AV_FOUND" = false ]; then
    # Check XProtect
    XPROTECT_VER=$(system_profiler SPInstallHistoryDataType 2>/dev/null | grep -A1 "XProtect" | grep "Version" | tail -1 | awk '{print $NF}')
    GATEKEEPER=$(spctl --status 2>/dev/null)
    MRT_EXISTS=$(ls /Library/Apple/System/Library/CoreServices/MRT.app 2>/dev/null)

    if echo "$GATEKEEPER" | grep -qi "enabled"; then
        add_pass "Gatekeeper is enabled. XProtect is active."
        AV_FOUND=true
    fi
fi

if [ "$AV_FOUND" = false ]; then
    add_vuln "No active antivirus or Gatekeeper detected." "Enable Gatekeeper or install antivirus"
fi
write_result ""

# 6.4 SIP (System Integrity Protection)
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [6.4] System Integrity Protection [ISMS 2.10] ---"
SIP_STATUS=$(csrutil status 2>/dev/null)
if echo "$SIP_STATUS" | grep -qi "enabled"; then
    add_pass "SIP (System Integrity Protection) is enabled."
else
    add_vuln "SIP is DISABLED." "Restart in Recovery Mode and run: csrutil enable"
fi
write_result ""

# 6.5 Gatekeeper
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [6.5] Gatekeeper ---"
GK_STATUS=$(spctl --status 2>/dev/null)
if echo "$GK_STATUS" | grep -qi "enabled"; then
    add_pass "Gatekeeper is enabled."
else
    add_vuln "Gatekeeper is DISABLED." "sudo spctl --master-enable"
fi
write_result ""

# 6.6 AirDrop
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [6.6] AirDrop [ISMS 2.10.7] ---"
AIRDROP=$(defaults read com.apple.sharingd DiscoverableMode 2>/dev/null)
if [ "$AIRDROP" = "Off" ] || [ -z "$AIRDROP" ]; then
    add_pass "AirDrop is disabled or contacts-only."
elif [ "$AIRDROP" = "Contacts Only" ]; then
    add_pass "AirDrop is set to Contacts Only."
else
    add_warn "AirDrop is set to Everyone." "System Settings > General > AirDrop > set to Contacts Only or Off"
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

# 7.1 Remote Apple Events
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [7.1] Remote Apple Events ---"
RAE=$(systemsetup -getremoteappleevents 2>/dev/null)
if echo "$RAE" | grep -qi "off"; then
    add_pass "Remote Apple Events are disabled."
else
    add_warn "Remote Apple Events are enabled." "systemsetup -setremoteappleevents off"
fi
write_result ""

# 7.2 NTP
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [7.2] Time Synchronization / NTP [ISMS 2.9.6] ---"
NTP_ENABLED=$(systemsetup -getusingnetworktime 2>/dev/null)
if echo "$NTP_ENABLED" | grep -qi "on"; then
    NTP_SERVER=$(systemsetup -getnetworktimeserver 2>/dev/null | awk '{print $NF}')
    add_pass "NTP is enabled [Server: $NTP_SERVER]"
else
    add_warn "NTP is disabled." "systemsetup -setusingnetworktime on"
fi
write_result ""

# 7.3 Bluetooth
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [7.3] Bluetooth ---"
BT_POWER=$(defaults read /Library/Preferences/com.apple.Bluetooth ControllerPowerState 2>/dev/null)
if [ "$BT_POWER" = "0" ]; then
    add_pass "Bluetooth is disabled."
else
    add_info "Bluetooth is enabled."
    write_result "  Note: Disable Bluetooth if not in use per security policy"
fi
write_result ""

# 7.4 Find My Mac
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [7.4] Find My Mac ---"
FMM=$(nvram -x -p 2>/dev/null | grep -c "fmm-mobileme-token")
if [ "$FMM" -gt 0 ]; then
    add_pass "Find My Mac is enabled."
else
    add_info "Find My Mac does not appear to be enabled."
    write_result "  Note: Enable via System Settings > Apple ID > iCloud > Find My Mac"
fi
write_result ""

# 7.5 Hosts file
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
write_result "--- [7.5] Hosts File Integrity ---"
SUSPICIOUS=0
while IFS= read -r line; do
    trimmed=$(echo "$line" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
    [ -z "$trimmed" ] && continue
    echo "$trimmed" | grep -q '^#' && continue
    echo "$trimmed" | grep -qi 'localhost\|broadcasthost\|docker.internal\|kubernetes.docker.internal\|gateway.docker.internal\|host.docker.internal' && continue
    SUSPICIOUS=1
    break
done < /etc/hosts

if [ "$SUSPICIOUS" -eq 0 ]; then
    add_pass "No suspicious entries in hosts file."
else
    add_warn "Unexpected entries in hosts file." "Review /etc/hosts"
    add_info "Non-standard hosts entries:"
    while IFS= read -r line; do
        trimmed=$(echo "$line" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
        [ -z "$trimmed" ] && continue
        echo "$trimmed" | grep -q '^#' && continue
        echo "$trimmed" | grep -qi 'localhost\|broadcasthost\|docker.internal\|kubernetes.docker.internal' && continue
        write_result "  $trimmed"
    done < /etc/hosts
fi
write_result ""

# ============================================================================
# SUMMARY
# ============================================================================
if [ "$TOTAL_CHECKS" -gt 0 ]; then
    TOTAL_SCORE=$((PASS_COUNT * 100 / TOTAL_CHECKS))
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
write_result " 2.5.3 User Authentication     - Checks 1.3, 1.4"
write_result " 2.5.4 Password Management     - Checks 2.1~2.4"
write_result " 2.6.1 Network Access Control  - Checks 3.3, 3.4"
write_result " 2.6.6 Remote Access Control   - Checks 3.1, 3.2"
write_result " 2.7.1 Encryption Policy       - Check 6.2"
write_result " 2.9.4 Log Management          - Checks 5.1, 5.2"
write_result " 2.9.6 Time Synchronization    - Check 7.2"
write_result " 2.10.7 Removable Media        - Check 6.6"
write_result " 2.10.8 Patch Management       - Checks 4.1, 4.2"
write_result " 2.10.9 Malware Control        - Check 6.3"
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
