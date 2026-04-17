#!/bin/bash
# ============================================================================
# ISMS-P macOS Security Vulnerability Check Script (RTR-only)
# For CrowdStrike Falcon RTR
# ============================================================================
# Version: 1.6 (2026-04-17: Falcon §5.2 — bypass BSD date with awk-based epoch parser)
# Description: macOS 보안 설정 확인 스크립트 (결과를 표준출력으로만 출력)
# Usage (RTR): runscript -CloudFile="isms_vuln_check_macos_rtr"
# Notes:
#   - No result file is generated. All output is streamed to stdout so that
#     RTR can capture and display it after the scan completes.
#   - No interactive prompts (RTR is non-interactive).
# ============================================================================

# --- Pre-flight Check ---
if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: This script must be run as root (RTR runs as root by default)."
    exit 1
fi

# --- Setup ---
CURRENT_USER=$(stat -f %Su /dev/console)
TOTAL_CHECKS=0
VULN_COUNT=0
WARN_COUNT=0
PASS_COUNT=0
INFO_COUNT=0

# --- Helper functions (write to stdout) ---
out() {
    echo "$1"
}

add_pass() {
    out "[PASS] $1"
    PASS_COUNT=$((PASS_COUNT + 1))
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

add_vuln() {
    out "[VULN] $1"
    [ -n "$2" ] && out "  Fix: $2"
    VULN_COUNT=$((VULN_COUNT + 1))
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

add_warn() {
    out "[WARN] $1"
    [ -n "$2" ] && out "  Fix: $2"
    WARN_COUNT=$((WARN_COUNT + 1))
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

# add_info does not contribute to TOTAL_CHECKS (info-only reference data).
add_info() {
    out "[INFO] $1"
    INFO_COUNT=$((INFO_COUNT + 1))
}

# --- Header ---
OS_VERSION=$(sw_vers -productVersion 2>/dev/null || echo "Unknown")
OS_BUILD=$(sw_vers -buildVersion 2>/dev/null || echo "Unknown")

out "============================================================================"
out " ISMS-P macOS Vulnerability Check Report (RTR)"
out " Script Version: 1.6"
out "============================================================================"
out ""
out " Date: $(date '+%Y-%m-%d %H:%M:%S')"
out " Hostname: $(hostname)"
out " Console User: $CURRENT_USER"
out " OS: macOS $OS_VERSION ($OS_BUILD)"
out ""
out " Standard: ISMS-P Certification [Korea Information Security Management System]"
out " Controls: 2.5[Auth], 2.6[Access], 2.9[Ops], 2.10[Security], 2.11[Incident]"
out " Severity: VULN[Critical] / WARN[Warning] / PASS[Good] / INFO[Reference]"
out "============================================================================"
out ""

# ============================================================================
# SECTION 1: Account Management [ISMS 2.5]
# ============================================================================
out "============================================================================"
out " [1] Account Management [ISMS 2.5]"
out "============================================================================"
out ""

# 1.1 Guest account
out "--- [1.1] Guest Account Disabled [ISMS 2.5.1] ---"
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
out ""

# 1.2 Auto Login
out "--- [1.2] Auto Login Disabled [ISMS 2.5.1] ---"
login_user=$(defaults read /Library/Preferences/com.apple.loginwindow autoLoginUser 2>/dev/null)
if [ -z "$login_user" ]; then
    add_pass "Auto Login is disabled."
else
    add_vuln "Auto Login is ENABLED for user: $login_user" "Disable in System Preferences - Users & Groups - Login Options"
fi
out ""

# 1.3 Login Window Display
out "--- [1.3] Login Window Shows Name and Password [ISMS 2.5.3] ---"
show_fullname=$(defaults read /Library/Preferences/com.apple.loginwindow SHOWFULLNAME 2>/dev/null)
if [ "$show_fullname" = "1" ]; then
    add_pass "Login window shows name and password fields."
else
    add_warn "Login window shows user list (Value: ${show_fullname:-not set})" "Set to Name and Password in System Preferences - Users & Groups - Login Options"
fi
out ""

# 1.4 Local accounts list
out "--- [1.4] Local Account List [ISMS 2.5.1] ---"
add_info "Registered local accounts [review for unnecessary ones]:"
for user in $(dscl . -list /Users | grep -v '^_'); do
    uid=$(dscl . -read "/Users/$user" UniqueID 2>/dev/null | awk '{print $2}')
    if [ -n "$uid" ] && [ "$uid" -ge 200 ] 2>/dev/null; then
        out "  $user [UID=$uid]"
    fi
done
out ""

# ============================================================================
# SECTION 2: Password Policy [ISMS 2.5.4]
# ============================================================================
out "============================================================================"
out " [2] Password Policy [ISMS 2.5.4]"
out "============================================================================"
out ""

# 2.1 Password policy settings
out "--- [2.1] Password Policy Configuration ---"
policy=$(pwpolicy -getglobalpolicy 2>/dev/null)
if [ -n "$policy" ]; then
    min_chars=$(echo "$policy" | grep -oE "minChars=[0-9]+" | cut -d= -f2)
    req_alpha=$(echo "$policy" | grep -oE "requiresAlpha=[0-9]+" | cut -d= -f2)
    req_num=$(echo "$policy" | grep -oE "requiresNumeric=[0-9]+" | cut -d= -f2)
    use_history=$(echo "$policy" | grep -oE "usingHistory=[0-9]+" | cut -d= -f2)
    max_age=$(echo "$policy" | grep -oE "maxMinutesUntilChangePassword=[0-9]+" | cut -d= -f2)
    max_failed=$(echo "$policy" | grep -oE "maxFailedLoginAttempts=[0-9]+" | cut -d= -f2)

    out "  minChars: ${min_chars:-not set} (Target: >= 8)"
    out "  requiresAlpha: ${req_alpha:-not set} (Target: 1)"
    out "  requiresNumeric: ${req_num:-not set} (Target: 1)"
    out "  usingHistory: ${use_history:-not set} (Target: >= 12)"
    out "  maxMinutesUntilChangePassword: ${max_age:-not set} (Target: <= 129600 = 90 days)"
    out "  maxFailedLoginAttempts: ${max_failed:-not set} (Target: <= 10)"

    pw_vuln=false
    pw_warn=false
    [ "${min_chars:-0}" -lt 8 ] && pw_vuln=true && out "  -> [VULN] minChars < 8"
    [ "${req_alpha:-0}" -ne 1 ] && pw_vuln=true && out "  -> [VULN] requiresAlpha != 1"
    [ "${req_num:-0}" -ne 1 ] && pw_vuln=true && out "  -> [VULN] requiresNumeric != 1"
    [ "${use_history:-0}" -lt 12 ] && pw_vuln=true && out "  -> [VULN] usingHistory < 12"
    if [ -z "$max_age" ]; then
        pw_vuln=true && out "  -> [VULN] maxMinutesUntilChangePassword not set"
    elif [ "$max_age" -gt 129600 ] 2>/dev/null; then
        pw_vuln=true && out "  -> [VULN] maxMinutesUntilChangePassword > 129600 (over 90 days)"
    fi
    if [ -z "$max_failed" ]; then
        pw_warn=true && out "  -> [WARN] maxFailedLoginAttempts not set"
    elif [ "$max_failed" -gt 10 ] 2>/dev/null; then
        pw_warn=true && out "  -> [WARN] maxFailedLoginAttempts > 10"
    fi

    if $pw_vuln; then
        add_vuln "Password policy has issues (see above)." "Configure via pwpolicy or MDM profile"
    elif $pw_warn; then
        add_warn "Password policy needs improvement (see above)." "Set maxFailedLoginAttempts <= 10"
    else
        add_pass "Password policy is correctly configured."
    fi
else
    add_vuln "Unable to retrieve password policy (not configured)." "Configure password policy via pwpolicy or MDM profile"
fi
out ""

# ============================================================================
# SECTION 3: Services and Network [ISMS 2.6, 2.10]
# ============================================================================
out "============================================================================"
out " [3] Services and Network [ISMS 2.6, 2.10]"
out "============================================================================"
out ""

# 3.1 SSH (Remote Login)
out "--- [3.1] SSH / Remote Login [ISMS 2.6.6] ---"
ssh_status=$(sudo systemsetup -getremotelogin 2>/dev/null)
if echo "$ssh_status" | grep -qi "off"; then
    add_pass "SSH (Remote Login) is Off."
else
    add_warn "SSH (Remote Login) is On." "Disable in System Preferences - Sharing, or: sudo systemsetup -setremotelogin off"
fi
out ""

# 3.2 ARD (Apple Remote Desktop)
out "--- [3.2] Apple Remote Desktop [ISMS 2.6.6] ---"
ard_process=$(ps aux | grep ARDAgent | grep -v grep)
if [ -z "$ard_process" ]; then
    add_pass "ARDAgent is not running."
else
    add_warn "ARDAgent is running." "Disable in System Preferences - Sharing - Remote Management"
fi
out ""

# 3.3 Firewall
out "--- [3.3] Application Firewall [ISMS 2.6.1] ---"
fw_state=$(/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null)
if echo "$fw_state" | grep -q "enabled"; then
    add_pass "Application Firewall is enabled."
else
    add_vuln "Application Firewall is DISABLED." "Enable in System Preferences - Security & Privacy - Firewall"
fi
out ""

# 3.4 Stealth Mode
out "--- [3.4] Firewall Stealth Mode [ISMS 2.6.1] ---"
stealth_state=$(/usr/libexec/ApplicationFirewall/socketfilterfw --getstealthmode 2>/dev/null)
if echo "$stealth_state" | grep -q "enabled"; then
    add_pass "Stealth Mode is enabled."
else
    add_warn "Stealth Mode is disabled." "Enable: /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on"
fi
out ""

# 3.5 AirDrop
out "--- [3.5] AirDrop Disabled [ISMS 2.10.7] ---"
airdrop_disabled=$(sudo -u "$CURRENT_USER" defaults read com.apple.NetworkBrowser DisableAirDrop 2>/dev/null)
if [ "$airdrop_disabled" = "1" ]; then
    add_pass "AirDrop is disabled."
else
    add_warn "AirDrop is not disabled (Value: ${airdrop_disabled:-not set})." "Disable AirDrop or set to Contacts Only"
fi
out ""

# ============================================================================
# SECTION 4: Patch Management [ISMS 2.10.8]
# ============================================================================
out "============================================================================"
out " [4] Patch Management [ISMS 2.10.8, 2.10.9]"
out "============================================================================"
out ""

# 4.1 Software Update Settings
out "--- [4.1] Software Update Settings ---"
auto_check=$(defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled 2>/dev/null)
auto_download=$(defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload 2>/dev/null)
critical_update=$(defaults read /Library/Preferences/com.apple.SoftwareUpdate CriticalUpdateInstall 2>/dev/null)

out "  AutomaticCheckEnabled: ${auto_check:-not set} (Target: 1)"
out "  AutomaticDownload: ${auto_download:-not set} (Target: 1)"
out "  CriticalUpdateInstall: ${critical_update:-not set} (Target: 1)"

su_pass=true
[ "${auto_check:-0}" != "1" ] && su_pass=false && out "  -> [WARN] AutomaticCheckEnabled != 1"
[ "${auto_download:-0}" != "1" ] && su_pass=false && out "  -> [WARN] AutomaticDownload != 1"
[ "${critical_update:-0}" != "1" ] && su_pass=false && out "  -> [WARN] CriticalUpdateInstall != 1"

if $su_pass; then
    add_pass "Software Update settings are correctly configured."
else
    add_warn "Software Update settings need attention (see above)." "Enable in System Preferences - Software Update"
fi
out ""

# 4.2 Last update check
out "--- [4.2] Recent Software Updates ---"
add_info "Last 10 installed updates:"
softwareupdate --history 2>/dev/null | head -12 | while IFS= read -r line; do
    out "  $line"
done
out ""

# ============================================================================
# SECTION 5: Audit and Logging [ISMS 2.9.4/2.9.5]
# ============================================================================
out "============================================================================"
out " [5] Audit and Logging [ISMS 2.9.4, 2.9.5]"
out "============================================================================"
out ""

# --- Locate falconctl (covers Falcon 6.x and 7.x install paths) ---
FALCONCTL=""
for candidate in \
    "/Applications/Falcon.app/Contents/Resources/falconctl" \
    "/Library/CS/falconctl"; do
    if [ -x "$candidate" ]; then
        FALCONCTL="$candidate"
        break
    fi
done

# 5.1 EndpointSecurity client (CrowdStrike Falcon sensor running)
out "--- [5.1] EndpointSecurity Client (CrowdStrike Falcon Sensor) ---"
# Determine if the Falcon sensor is alive. The macOS sensor process is named
# "com.crowdstrike.falcon.Agent" (Falcon.app) or runs out of /Library/CS/, not
# "falcond" (which is the Linux name). The most reliable probe is whether
# falconctl can return a non-empty agentID — it queries the live daemon.
agent_id=""
if [ -n "$FALCONCTL" ]; then
    out "  falconctl: $FALCONCTL"
    agent_info=$("$FALCONCTL" stats agent_info 2>/dev/null)
    agent_id=$(echo "$agent_info" | awk -F': *' '/agentID/ {print $2; exit}')
    if [ -n "$agent_id" ]; then
        out "  agentID: $agent_id"
    fi
fi
falcon_proc=$(pgrep -fl "Falcon.app/Contents/MacOS|/Library/CS/" 2>/dev/null | head -1)
[ -n "$falcon_proc" ] && out "  process: $falcon_proc"

if [ -n "$FALCONCTL" ] && [ -n "$agent_id" ]; then
    add_pass "CrowdStrike Falcon EndpointSecurity sensor is running (agentID present)."
elif [ -n "$FALCONCTL" ] && [ -n "$falcon_proc" ]; then
    add_warn "Falcon process detected but agentID not retrievable." "Run: sudo $FALCONCTL stats agent_info"
elif [ -n "$FALCONCTL" ]; then
    add_vuln "Falcon installed but sensor not running (no agentID, no process)." "Start Falcon sensor or check installation integrity"
else
    add_vuln "CrowdStrike Falcon EndpointSecurity sensor is NOT installed." "Install/enable Falcon sensor (provisioning required)"
fi
out ""

# 5.2 EndpointSecurity telemetry (Falcon cloud connectivity)
out "--- [5.2] EndpointSecurity Telemetry (Falcon Cloud Communications) ---"
# The macOS Falcon sensor's "Communications" stats does NOT expose a
# "State:" line. The authoritative health signals are:
#   - "Established At:" = current active cloud connection start time (if connected)
#   - "Connects:"       = lifetime successful connection count
# An empty "Established At" with a non-zero "Connects" means the sensor was
# previously connected but is currently disconnected.
if [ -n "$FALCONCTL" ]; then
    comm_stats=$("$FALCONCTL" stats Communications 2>/dev/null)

    # Both "Established At" and "Last Established At" lines exist on macOS;
    # we want only the one without "Last", so anchor on the exact prefix.
    estab=$(echo "$comm_stats" | grep -E '^[[:space:]]+Established At[[:space:]]*:' | head -1 | cut -d: -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    last_estab=$(echo "$comm_stats" | grep -E '^[[:space:]]+Last Established At[[:space:]]*:' | head -1 | cut -d: -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    connects=$(echo "$comm_stats" | grep -E '^[[:space:]]+Connects[[:space:]]*:' | head -1 | cut -d: -f2- | tr -d '[:space:]')

    [ -n "$estab" ]      && out "  Established At:      $estab"
    [ -n "$last_estab" ] && out "  Last Established At: $last_estab"
    [ -n "$connects" ]   && out "  Connects (lifetime): $connects"

    # Inline timestamp parser — no function. Convert "Apr 17, 2026 at 1:18:56 PM"
    # to epoch via BSD date. Strip "at " and zero-pad single-digit hours.
    now_epoch=$(date "+%s")

    # Convert "Apr 17, 2026 at 1:37:52 PM" -> epoch via awk.
    # Avoids BSD `date -j -f` entirely (it's locale-sensitive and rejects our
    # format under RTR's POSIX environment). Awk is locale-neutral.
    falcon_to_epoch() {
        # $1 = "Apr 17, 2026 at 1:37:52 PM"
        echo "$1" | awk '
        BEGIN {
            m["Jan"]=1; m["Feb"]=2; m["Mar"]=3; m["Apr"]=4;
            m["May"]=5; m["Jun"]=6; m["Jul"]=7; m["Aug"]=8;
            m["Sep"]=9; m["Oct"]=10; m["Nov"]=11; m["Dec"]=12;
            # Days before each month in a non-leap year.
            d[1]=0;   d[2]=31;  d[3]=59;  d[4]=90;
            d[5]=120; d[6]=151; d[7]=181; d[8]=212;
            d[9]=243; d[10]=273; d[11]=304; d[12]=334;
        }
        {
            # Strip commas and split on whitespace.
            gsub(/,/, "");
            n = split($0, f, /[ \t]+/);
            # Expected fields: Apr 17 2026 at 1:37:52 PM
            mon = m[f[1]];
            day = f[2] + 0;
            yr  = f[3] + 0;
            # f[4] = "at"; f[5] = "1:37:52"; f[6] = "PM"
            split(f[5], hms, ":");
            hr  = hms[1] + 0;
            mi  = hms[2] + 0;
            sc  = hms[3] + 0;
            ampm = f[6];
            if (ampm == "PM" && hr < 12) hr += 12;
            if (ampm == "AM" && hr == 12) hr = 0;
            if (mon < 1 || yr < 1970) { print 0; exit }
            # Days since 1970-01-01 (UTC). Leap years: divisible by 4,
            # except centuries unless divisible by 400.
            days = 0;
            for (y = 1970; y < yr; y++) {
                days += 365;
                if ((y % 4 == 0 && y % 100 != 0) || (y % 400 == 0)) days++;
            }
            days += d[mon];
            # If current year is leap and we are past Feb, add a day.
            if (mon > 2 && ((yr % 4 == 0 && yr % 100 != 0) || (yr % 400 == 0))) days++;
            days += day - 1;
            # Local-time epoch (matches `date "+%s"` for same TZ since both
            # interpret the time as local).
            print days * 86400 + hr * 3600 + mi * 60 + sc;
        }'
    }

    estab_epoch=""
    if [ -n "$estab" ]; then
        estab_epoch=$(falcon_to_epoch "$estab")
        # awk returns local-time epoch (no TZ adjustment); compensate by
        # subtracting the local TZ offset to get true UTC epoch.
        # `date "+%z"` returns "+0900" / "-0500" etc.
        tz=$(date "+%z")
        tz_sign=$(echo "$tz" | cut -c1)
        tz_h=$(echo "$tz" | cut -c2-3)
        tz_m=$(echo "$tz" | cut -c4-5)
        tz_off=$(( 10#$tz_h * 3600 + 10#$tz_m * 60 ))
        if [ "$tz_sign" = "+" ]; then
            estab_epoch=$(( estab_epoch - tz_off ))
        else
            estab_epoch=$(( estab_epoch + tz_off ))
        fi
        if [ "$estab_epoch" -le 0 ] 2>/dev/null; then
            estab_epoch=""
        fi
    fi

    last_estab_epoch=""
    if [ -n "$last_estab" ]; then
        last_estab_epoch=$(falcon_to_epoch "$last_estab")
        tz=$(date "+%z")
        tz_sign=$(echo "$tz" | cut -c1)
        tz_h=$(echo "$tz" | cut -c2-3)
        tz_m=$(echo "$tz" | cut -c4-5)
        tz_off=$(( 10#$tz_h * 3600 + 10#$tz_m * 60 ))
        if [ "$tz_sign" = "+" ]; then
            last_estab_epoch=$(( last_estab_epoch - tz_off ))
        else
            last_estab_epoch=$(( last_estab_epoch + tz_off ))
        fi
        if [ "$last_estab_epoch" -le 0 ] 2>/dev/null; then
            last_estab_epoch=""
        fi
    fi

    # Primary: current active connection. "Established At" set AND parseable
    # AND within the last 24h means the sensor is currently connected.
    if [ -n "$estab_epoch" ] && [ "$estab_epoch" -gt 0 ]; then
        age_h=$(( (now_epoch - estab_epoch) / 3600 ))
        out "  Current connection age: ${age_h}h"
        if [ $(( now_epoch - estab_epoch )) -lt 86400 ]; then
            add_pass "Falcon sensor connected to CrowdStrike cloud (Established ${age_h}h ago)."
        else
            add_warn "Falcon connection is stale (Established ${age_h}h ago)." "Check network connectivity"
        fi
    elif [ -n "$last_estab_epoch" ] && [ "$last_estab_epoch" -gt 0 ]; then
        # Fallback: no current connection, but a previous one existed.
        age_h=$(( (now_epoch - last_estab_epoch) / 3600 ))
        out "  Last connection age: ${age_h}h"
        if [ $(( now_epoch - last_estab_epoch )) -lt 86400 ]; then
            add_warn "Falcon sensor disconnected; last connection was ${age_h}h ago." "Verify cloud connectivity: sudo $FALCONCTL stats Communications"
        else
            add_vuln "Falcon sensor last connected ${age_h}h ago (>24h)." "Check network/proxy and run: sudo $FALCONCTL stats Communications"
        fi
    elif [ -n "$connects" ] && [ "$connects" -gt 0 ] 2>/dev/null; then
        # Last resort: timestamps unparseable but Connects > 0 means the sensor
        # has talked to the cloud at some point during its lifetime.
        add_warn "Falcon connection state unclear (Connects=$connects, no parseable timestamp)." "Inspect: sudo $FALCONCTL stats Communications"
    else
        add_vuln "Falcon sensor has never connected to CrowdStrike cloud." "Check network/proxy and run: sudo $FALCONCTL stats Communications"
    fi
else
    add_vuln "falconctl not found - cannot verify EndpointSecurity telemetry." "Install CrowdStrike Falcon sensor"
fi
out ""

# 5.3 Install.log and system.log
out "--- [5.3] System Log Availability ---"
log_pass=true
if [ -f /var/log/install.log ]; then
    out "  install.log: exists"
else
    out "  install.log: NOT found"
    log_pass=false
fi
if [ -d /var/log ]; then
    out "  /var/log directory: exists"
else
    out "  /var/log directory: NOT found"
    log_pass=false
fi
if $log_pass; then
    add_pass "System logs are available."
else
    add_warn "Some system logs are missing." "Verify log rotation and storage"
fi
out ""

# ============================================================================
# SECTION 6: Security Settings [ISMS 2.7, 2.10]
# ============================================================================
out "============================================================================"
out " [6] Security Settings [ISMS 2.7, 2.10, 2.11]"
out "============================================================================"
out ""

# 6.1 Screensaver Lock
out "--- [6.1] Screen Saver Lock ---"
idle_time=$(sudo -u "$CURRENT_USER" defaults -currentHost read com.apple.screensaver idleTime 2>/dev/null)
ask_pass=$(sudo -u "$CURRENT_USER" defaults -currentHost read com.apple.screensaver askForPassword 2>/dev/null)
ask_delay=$(sudo -u "$CURRENT_USER" defaults -currentHost read com.apple.screensaver askForPasswordDelay 2>/dev/null)

out "  Idle Time (Seconds): ${idle_time:-not set} (Target: <= 600)"
out "  Ask Password: ${ask_pass:-not set} (Target: 1)"
out "  Ask Password Delay: ${ask_delay:-not set} (Target: 0)"

ss_pass=true
if [ -z "$idle_time" ]; then
    ss_pass=false
    out "  -> [VULN] idleTime not set"
elif [ "$idle_time" -gt 600 ] 2>/dev/null; then
    ss_pass=false
    out "  -> [WARN] idleTime > 600 seconds"
fi
if [ "${ask_pass:-0}" != "1" ]; then
    ss_pass=false
    out "  -> [VULN] askForPassword != 1"
fi

if $ss_pass; then
    add_pass "Screensaver lock is correctly configured."
else
    add_vuln "Screensaver settings need attention (see above)." "Set in System Preferences - Desktop & Screen Saver / Security & Privacy"
fi
out ""

# 6.2 Display Sleep
out "--- [6.2] Display Sleep Settings ---"
add_info "Power management display sleep settings:"
pmset -g custom 2>/dev/null | grep -E "Battery Power|AC Power|displaysleep" | while IFS= read -r line; do
    out "  $line"
done
out ""

# 6.3 FileVault (Disk Encryption)
out "--- [6.3] FileVault Encryption [ISMS 2.7.1] ---"
fv_status=$(fdesetup status 2>/dev/null)
out "  $fv_status"
if echo "$fv_status" | grep -q "On"; then
    add_pass "FileVault is enabled."
else
    add_vuln "FileVault is NOT enabled." "Enable FileVault in System Preferences - Security & Privacy"
fi
out ""

# 6.4 SIP (System Integrity Protection)
out "--- [6.4] System Integrity Protection (SIP) ---"
sip_status=$(csrutil status 2>/dev/null)
out "  $sip_status"
if echo "$sip_status" | grep -q "enabled"; then
    add_pass "SIP is enabled."
else
    add_vuln "SIP is DISABLED." "Boot to Recovery Mode and run: csrutil enable"
fi
out ""

# 6.5 Gatekeeper
out "--- [6.5] Gatekeeper [ISMS 2.10.9] ---"
gk_status=$(spctl --status 2>/dev/null)
if echo "$gk_status" | grep -q "enabled"; then
    add_pass "Gatekeeper is enabled."
else
    add_vuln "Gatekeeper is DISABLED." "Enable: sudo spctl --master-enable"
fi
out ""

# 6.6 XProtect (Antivirus)
out "--- [6.6] XProtect / Malware Removal Tool [ISMS 2.10.9] ---"
xprotect_meta=$(system_profiler SPInstallHistoryDataType 2>/dev/null | grep -A1 "XProtect" | tail -1 | xargs)
mrt_meta=$(system_profiler SPInstallHistoryDataType 2>/dev/null | grep -A1 "MRTConfigData" | tail -1 | xargs)
if [ -d "/Library/Apple/System/Library/CoreServices/XProtect.bundle" ]; then
    add_pass "XProtect bundle is present."
    [ -n "$xprotect_meta" ] && out "  Last XProtect update: $xprotect_meta"
else
    add_warn "XProtect bundle not found." "Ensure macOS security updates are installed"
fi
out ""

# ============================================================================
# SECTION 7: Additional [ISMS 2.9, 2.11]
# ============================================================================
out "============================================================================"
out " [7] Additional Security [ISMS 2.9, 2.11]"
out "============================================================================"
out ""

# 7.1 Bluetooth sharing
out "--- [7.1] Bluetooth Sharing [ISMS 2.10.7] ---"
bt_sharing=$(defaults read /Library/Preferences/com.apple.Bluetooth PrefKeyServicesEnabled 2>/dev/null)
if [ "$bt_sharing" = "0" ] || [ -z "$bt_sharing" ]; then
    add_pass "Bluetooth sharing is disabled."
else
    add_warn "Bluetooth sharing is enabled." "Disable in System Preferences - Sharing"
fi
out ""

# 7.2 Internet Sharing
out "--- [7.2] Internet Sharing ---"
internet_sharing=$(defaults read /Library/Preferences/SystemConfiguration/com.apple.nat NAT 2>/dev/null | grep -c "Enabled = 1")
if [ "$internet_sharing" = "0" ] || [ -z "$internet_sharing" ]; then
    add_pass "Internet Sharing is disabled."
else
    add_warn "Internet Sharing is enabled." "Disable in System Preferences - Sharing"
fi
out ""

# 7.3 NTP (Time Synchronization)
out "--- [7.3] Time Synchronization / NTP [ISMS 2.9.6] ---"
ntp_enabled=$(sudo systemsetup -getusingnetworktime 2>/dev/null)
if echo "$ntp_enabled" | grep -qi "on"; then
    add_pass "Network Time synchronization is enabled."
else
    add_warn "Network Time synchronization is OFF." "Enable: sudo systemsetup -setusingnetworktime on"
fi
out ""

# 7.4 Remote Apple Events
out "--- [7.4] Remote Apple Events [ISMS 2.6.6] ---"
rae_status=$(sudo systemsetup -getremoteappleevents 2>/dev/null)
if echo "$rae_status" | grep -qi "off"; then
    add_pass "Remote Apple Events is Off."
else
    add_warn "Remote Apple Events is On." "Disable: sudo systemsetup -setremoteappleevents off"
fi
out ""

# 7.5 Firmware Password (Intel) / Secure Boot (Apple Silicon)
out "--- [7.5] Boot Security ---"
arch=$(uname -m)
if [ "$arch" = "arm64" ]; then
    add_info "Apple Silicon detected. Secure Boot is enforced by default."
    out "  Architecture: Apple Silicon ($arch)"
else
    fw_pass=$(firmwarepasswd -check 2>/dev/null)
    if echo "$fw_pass" | grep -qi "Yes"; then
        add_pass "Firmware password is set."
    else
        add_warn "Firmware password is NOT set." "Set via: sudo firmwarepasswd -setpasswd"
    fi
fi
out ""

# 7.6 Hosts file integrity
out "--- [7.6] Hosts File Integrity ---"
SAFE_PATTERNS="localhost|broadcasthost|docker\.internal|kubernetes\.docker\.internal|host\.docker\.internal"
suspicious_found=false
while IFS= read -r line; do
    trimmed=$(echo "$line" | sed 's/^[[:space:]]*//')
    [ -z "$trimmed" ] && continue
    echo "$trimmed" | grep -q "^#" && continue
    if ! echo "$trimmed" | grep -qE "$SAFE_PATTERNS"; then
        out "  [!] $trimmed"
        suspicious_found=true
    fi
done < /etc/hosts 2>/dev/null

if $suspicious_found; then
    add_warn "Unexpected entries in hosts file." "Review /etc/hosts"
else
    add_pass "No suspicious entries in hosts file."
fi
out ""

# ============================================================================
# SUMMARY
# ============================================================================
if [ "$TOTAL_CHECKS" -gt 0 ]; then
    TOTAL_SCORE=$(( PASS_COUNT * 100 / TOTAL_CHECKS ))
else
    TOTAL_SCORE=0
fi

out "============================================================================"
out " SUMMARY"
out "============================================================================"
out ""
out " Total checks:    $TOTAL_CHECKS"
out " --------------------------------"
out " [VULN] Critical: $VULN_COUNT"
out " [WARN] Warning:  $WARN_COUNT"
out " [PASS] Good:     $PASS_COUNT"
out " [INFO] Info:     $INFO_COUNT"
out " --------------------------------"
out " Security Score:  ~${TOTAL_SCORE}%"
out ""

if [ "$VULN_COUNT" -gt 0 ]; then
    out " [!] $VULN_COUNT critical issues found. Immediate action required."
fi
if [ "$WARN_COUNT" -gt 0 ]; then
    out " [*] $WARN_COUNT warnings found. Improvement recommended."
fi

out ""
out "============================================================================"
out " ISMS-P Control Mapping"
out "============================================================================"
out ""
out " 2.5.1 User Account Mgmt       - Checks 1.1~1.4"
out " 2.5.3 User Authentication     - Check 1.3"
out " 2.5.4 Password Management     - Check 2.1"
out " 2.6.1 Network Access Control  - Checks 3.3, 3.4"
out " 2.6.6 Remote Access Control   - Checks 3.1, 3.2, 7.4"
out " 2.7.1 Encryption Policy       - Check 6.3"
out " 2.9.4 Log Management          - Checks 5.1~5.3"
out " 2.9.5 Log Review              - Check 5.2"
out " 2.9.6 Time Synchronization    - Check 7.3"
out " 2.10.7 Removable Media        - Checks 3.5, 7.1"
out " 2.10.8 Patch Management       - Checks 4.1, 4.2"
out " 2.10.9 Malware Control        - Checks 6.5, 6.6"
out " 2.11.2 Vulnerability Check    - This entire script"
out ""
out "============================================================================"
out " Scan Complete"
out "============================================================================"
out " Total: $TOTAL_CHECKS checks  |  VULN: $VULN_COUNT  WARN: $WARN_COUNT  PASS: $PASS_COUNT  INFO: $INFO_COUNT"
out "============================================================================"
