#!/bin/bash
# ============================================
# macOS Initial Security Configuration Script
# For CrowdStrike Falcon RTR / Terminal
# ============================================
# Version: 2.0
# Description: macOS 초기 보안 세팅 조치 스크립트
# Usage (Terminal): sudo bash isms_security_setup_macos.sh
# Usage (RTR):      runscript -CloudFile="isms_security_setup_macos"
# ============================================

# --- Pre-flight Check ---
if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: This script must be run as root (use sudo)."
    exit 1
fi

CURRENT_USER=$(stat -f %Su /dev/console)
echo "============================================"
echo " macOS Security Configuration - Setup"
echo " Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo " Hostname: $(hostname)"
echo " OS Version: $(sw_vers -productVersion)"
echo " Console User: $CURRENT_USER"
echo "============================================"

SUCCESS_COUNT=0
FAIL_COUNT=0

log_result() {
    if [ $1 -eq 0 ]; then
        echo "[OK] $2"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "[ERROR] $2"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# === 1. Password Policy (한 줄로 통합하여 덮어쓰기 방지) ===
echo -e "\n--- 1. Setting Password Policy ---"
pwpolicy -setglobalpolicy \
    "usingHistory=12 minChars=10 requiresAlpha=1 requiresNumeric=1 maxMinutesUntilChangePassword=129600 maxFailedLoginAttempts=10"
log_result $? "Password Policy"

# 설정 확인
echo "  Verifying:"
pwpolicy -getglobalpolicy 2>/dev/null | tr ' ' '\n' | grep -E "minChars|requiresAlpha|requiresNumeric|usingHistory|maxMinutesUntilChangePassword|maxFailedLoginAttempts" | sed 's/^/    /'

# === 2. Disable Auto Login ===
echo -e "\n--- 2. Disabling Auto Login ---"
defaults delete /Library/Preferences/com.apple.loginwindow autoLoginUser 2>/dev/null || true
login_check=$(defaults read /Library/Preferences/com.apple.loginwindow autoLoginUser 2>/dev/null)
if [ -z "$login_check" ]; then
    log_result 0 "Auto Login Disabled"
else
    log_result 1 "Auto Login still enabled for: $login_check"
fi

# === 3. Login Window - Show Name and Password Fields ===
echo -e "\n--- 3. Setting Login Window to Name/Password Fields ---"
defaults write /Library/Preferences/com.apple.loginwindow SHOWFULLNAME -bool true
show_fullname=$(defaults read /Library/Preferences/com.apple.loginwindow SHOWFULLNAME 2>/dev/null)
if [ "$show_fullname" = "1" ]; then
    log_result 0 "Login Window set to Name/Password fields"
else
    log_result 1 "Login Window setting failed (Value: ${show_fullname:-not set})"
fi

# === 4. Screensaver & Display Sleep ===
echo -e "\n--- 4. Configuring Screensaver & Display Sleep ---"

# 화면 보호기 대기 시간 (600초 = 10분)
sudo -u "$CURRENT_USER" defaults -currentHost write com.apple.screensaver idleTime -int 600
log_result $? "Screensaver idle time (600s)"

# 화면 보호기 해제 시 암호 요구 (defaults 방식 - osascript보다 안정적)
sudo -u "$CURRENT_USER" defaults -currentHost write com.apple.screensaver askForPassword -int 1
log_result $? "Screensaver password requirement"

# 암호 요구 지연 시간 (0초 = 즉시)
sudo -u "$CURRENT_USER" defaults -currentHost write com.apple.screensaver askForPasswordDelay -int 0
log_result $? "Screensaver password delay (0s)"

# 디스플레이 슬립 (배터리/전원 모두 10분)
pmset -b displaysleep 10
log_result $? "Display sleep on battery (10min)"

pmset -c displaysleep 10
log_result $? "Display sleep on AC power (10min)"

# preferences 캐시 리로드 (스크립트 중간이 아닌 이 섹션 마지막에 1회만)
killall cfprefsd 2>/dev/null || true

# === 5. Disable Remote Management ===
echo -e "\n--- 5. Disabling Remote Management ---"

# ARD 비활성화
/System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \
    -deactivate -stop 2>/dev/null
log_result $? "ARD (Apple Remote Desktop) deactivated"

# SSH 비활성화
systemsetup -f -setremotelogin off 2>/dev/null
log_result $? "SSH (Remote Login) disabled"

# === 6. Firewall ===
echo -e "\n--- 6. Configuring Firewall ---"

# 방화벽 활성화
fw_state=$(/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null)
if echo "$fw_state" | grep -q "enabled"; then
    echo "  Firewall is already enabled"
    log_result 0 "Firewall enabled"
else
    /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
    log_result $? "Firewall enabled"
fi

# 스텔스 모드 활성화
/usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on
log_result $? "Firewall stealth mode enabled"

# 상태 확인
/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
/usr/libexec/ApplicationFirewall/socketfilterfw --getstealthmode

# === 7. Software Update ===
echo -e "\n--- 7. Configuring Software Update ---"

defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled -bool true
log_result $? "Software Update - Automatic Check"

defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload -bool true
log_result $? "Software Update - Automatic Download"

defaults write /Library/Preferences/com.apple.SoftwareUpdate CriticalUpdateInstall -bool true
log_result $? "Software Update - Critical Update Install"

# === 8. Disable AirDrop ===
echo -e "\n--- 8. Disabling AirDrop ---"
sudo -u "$CURRENT_USER" defaults write com.apple.NetworkBrowser DisableAirDrop -bool true
log_result $? "AirDrop disabled"

# === 9. Disable Internet Sharing (NAT) ===
echo -e "\n--- 9. Disabling Internet Sharing ---"
defaults write /Library/Preferences/SystemConfiguration/com.apple.nat NAT -dict Enabled -int 0
log_result $? "Internet Sharing (NAT) disabled in preferences"

launchctl unload -w /System/Library/LaunchDaemons/com.apple.InternetSharing.plist 2>/dev/null
# unload returns non-zero if already unloaded; treat as success either way
echo "  Verifying:"
nat_enabled=$(defaults read /Library/Preferences/SystemConfiguration/com.apple.nat NAT 2>/dev/null | grep -c "Enabled = 1")
if [ "$nat_enabled" -eq 0 ]; then
    log_result 0 "Internet Sharing confirmed off"
else
    log_result 1 "Internet Sharing still appears enabled"
fi

# === 10. Disable Remote Apple Events ===
echo -e "\n--- 10. Disabling Remote Apple Events ---"
systemsetup -setremoteappleevents off 2>/dev/null
log_result $? "Remote Apple Events disabled"
echo "  Verifying:"
systemsetup -getremoteappleevents 2>/dev/null | sed 's/^/    /'

# === 11. Verify EndpointSecurity Client (CrowdStrike Falcon) ===
echo -e "\n--- 11. Verifying EndpointSecurity Client (Falcon Sensor) ---"

FALCONCTL=""
for candidate in \
    "/Applications/Falcon.app/Contents/Resources/falconctl" \
    "/Library/CS/falconctl"; do
    if [ -x "$candidate" ]; then
        FALCONCTL="$candidate"
        break
    fi
done

# 11.1 Sensor process running
if pgrep -x falcond >/dev/null 2>&1; then
    log_result 0 "Falcon sensor process (falcond) is running"
else
    log_result 1 "Falcon sensor process (falcond) NOT running - install/enable Falcon"
fi

# 11.2 Sensor cloud connectivity
if [ -n "$FALCONCTL" ]; then
    echo "  falconctl: $FALCONCTL"
    comm_state=$("$FALCONCTL" stats Communications 2>/dev/null \
        | awk -F': *' '/State/ {print $2; exit}')
    echo "  Communications State: ${comm_state:-unknown}"
    if echo "$comm_state" | grep -qi "Established"; then
        log_result 0 "Falcon sensor connected to CrowdStrike cloud (telemetry active)"
    else
        log_result 1 "Falcon sensor not reporting to cloud (State: ${comm_state:-unknown})"
    fi
else
    log_result 1 "falconctl not found - Falcon sensor not installed"
fi

# === 12. Verification (SIP, FileVault - Read Only) ===
echo -e "\n--- 12. Read-Only Security Status ---"

echo "SIP Status:"
csrutil status 2>/dev/null | sed 's/^/  /'

echo "FileVault Status:"
fdesetup status 2>/dev/null | sed 's/^/  /'

# === Summary ===
TOTAL=$((SUCCESS_COUNT + FAIL_COUNT))
echo -e "\n============================================"
echo " SETUP SUMMARY"
echo "============================================"
echo " SUCCESS: $SUCCESS_COUNT / $TOTAL"
echo " FAILED:  $FAIL_COUNT / $TOTAL"
echo "============================================"
if [ "$FAIL_COUNT" -eq 0 ]; then
    echo " STATUS: ALL CONFIGURATIONS APPLIED"
else
    echo " STATUS: $FAIL_COUNT ITEM(S) FAILED - REVIEW ABOVE"
fi
echo "============================================"
echo ""
echo "Next: Run the verification script to confirm all settings."