"""
취약점 점검 결과 파일 파서

지원 형식:
- TXT: ISMS-P Windows Vulnerability Check Report 형식
- JSON: { "summary": { "vuln": N, "warn": N, "pass": N, "info": N }, "details": [...] }
- CSV: severity,check_id,check_name,result,description
"""
import csv
import io
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class ParsedResult:
    """파싱된 결과

    severity 매핑 (현행 ISMS-P 점검 스크립트 기준):
      [VULN] -> severity_high (취약)
      [WARN] -> severity_medium (경고)
      [INFO] -> info_count (참조용). vulnerabilities_found 에 합산하지 않음.
      [PASS] -> 취약점 아님. 카운트만 보존.

    severity_low 는 미사용 (현행 점검 스크립트가 Low 티어를 내보내지 않음).
    호환을 위해 필드는 유지하되 항상 0.
    """
    status: str = "completed"
    result_summary: str = ""
    result_detail: str = ""
    vulnerabilities_found: int = 0
    severity_high: int = 0     # VULN (취약)
    severity_medium: int = 0   # WARN (경고)
    severity_low: int = 0      # 미사용 (Low 티어 없음)
    info_count: int = 0        # INFO (참조용)
    error_message: Optional[str] = None
    checks: List[Dict] = field(default_factory=list)


def parse_result_file(content: str, file_name: str) -> ParsedResult:
    """
    파일 내용과 확장자를 기반으로 적절한 파서 선택

    Args:
        content: 파일 내용 (문자열)
        file_name: 파일명 (확장자 판별용)

    Returns:
        ParsedResult
    """
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else "txt"

    if ext == "json":
        return _parse_json(content)
    elif ext == "csv":
        return _parse_csv(content)
    else:
        return _parse_txt(content)


def _parse_txt(content: str) -> ParsedResult:
    """
    ISMS-P Windows/macOS Vulnerability Check Report TXT 형식 파싱

    태그 기반 파싱 (현행 점검 스크립트는 Low 티어 미사용):
    - [VULN] = 취약   -> severity_high
    - [WARN] = 경고   -> severity_medium
    - [PASS] = 통과   -> 카운트만 보존
    - [INFO] = 참조   -> 취약점 수에 미반영

    SUMMARY 섹션에서 정확한 카운트 추출
    """
    result = ParsedResult()
    result.result_detail = content

    checks = []
    vuln_count = 0
    warn_count = 0
    pass_count = 0
    info_count = 0

    # 개별 체크 항목 파싱
    current_section = ""
    for line in content.splitlines():
        stripped = line.strip()

        # 섹션 헤더 감지
        section_match = re.match(r'\[(\d+)\]\s+(.+)', stripped)
        if section_match:
            current_section = section_match.group(2).strip()
            continue

        # 개별 결과 태그 파싱
        tag_match = re.match(r'\[(VULN|WARN|PASS|INFO)\]\s+(.*)', stripped)
        if tag_match:
            tag = tag_match.group(1)
            desc = tag_match.group(2).strip()
            checks.append({
                "severity": tag,
                "section": current_section,
                "description": desc,
            })

    # SUMMARY 섹션에서 카운트 추출 (가장 정확)
    summary_match = re.search(
        r'\[VULN\]\s*Critical:\s*(\d+).*?'
        r'\[WARN\]\s*Warning:\s*(\d+).*?'
        r'\[PASS\]\s*Good:\s*(\d+).*?'
        r'\[INFO\]\s*Info:\s*(\d+)',
        content,
        re.DOTALL,
    )

    if summary_match:
        vuln_count = int(summary_match.group(1))
        warn_count = int(summary_match.group(2))
        pass_count = int(summary_match.group(3))
        info_count = int(summary_match.group(4))
    else:
        # SUMMARY 없으면 태그 카운트로 대체
        for check in checks:
            if check["severity"] == "VULN":
                vuln_count += 1
            elif check["severity"] == "WARN":
                warn_count += 1
            elif check["severity"] == "PASS":
                pass_count += 1
            elif check["severity"] == "INFO":
                info_count += 1

    result.severity_high = vuln_count
    result.severity_medium = warn_count
    result.severity_low = 0
    result.info_count = info_count
    # 취약점 수에서 INFO 제외 (참조 데이터일 뿐, 취약점이 아님).
    result.vulnerabilities_found = vuln_count + warn_count
    result.checks = checks

    # 총 체크 수 추출
    total_match = re.search(r'Total checks:\s*(\d+)', content)
    total_checks = int(total_match.group(1)) if total_match else len(checks)

    # Security Score 추출
    score_match = re.search(r'Security Score:\s*~?(\d+)%', content)
    score = score_match.group(1) if score_match else "N/A"

    # 요약 생성 (Info 는 참조 항목임을 명시)
    result.result_summary = (
        f"총 {total_checks}개 점검 항목 | "
        f"취약: {vuln_count}, 경고: {warn_count}, "
        f"통과: {pass_count}, 정보(참조): {info_count} | "
        f"보안 점수: {score}%"
    )

    return result


def _parse_json(content: str) -> ParsedResult:
    """
    JSON 형식 파싱

    기대 형식:
    {
      "summary": { "vuln": 0, "warn": 6, "pass": 21, "info": 4 },
      "total_checks": 31,
      "security_score": 68,
      "checks": [
        { "severity": "WARN", "id": "1.3", "name": "...", "description": "..." },
        ...
      ]
    }
    """
    result = ParsedResult()
    result.result_detail = content

    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        result.status = "failed"
        result.error_message = f"JSON 파싱 오류: {e}"
        return result

    summary = data.get("summary", {})
    result.severity_high = summary.get("vuln", 0) + summary.get("critical", 0) + summary.get("high", 0)
    result.severity_medium = summary.get("warn", 0) + summary.get("warning", 0) + summary.get("medium", 0)
    # severity_low 미사용 — Low 티어 없음. INFO 는 info_count 로 분리.
    result.severity_low = 0
    result.info_count = summary.get("info", 0)
    info_count = result.info_count
    # 취약점 수에서 INFO 제외.
    result.vulnerabilities_found = result.severity_high + result.severity_medium

    total = data.get("total_checks", result.vulnerabilities_found + summary.get("pass", 0) + info_count)
    score = data.get("security_score", "N/A")

    result.result_summary = (
        f"총 {total}개 점검 항목 | "
        f"취약: {result.severity_high}, 경고: {result.severity_medium}, "
        f"정보(참조): {info_count} | "
        f"보안 점수: {score}%"
    )

    result.checks = data.get("checks", [])
    return result


def _parse_csv(content: str) -> ParsedResult:
    """
    CSV 형식 파싱

    기대 컬럼: severity, check_id, check_name, result, description
    severity 값: VULN, WARN, PASS, INFO (또는 HIGH, MEDIUM, LOW)
    """
    result = ParsedResult()
    result.result_detail = content

    vuln_count = 0
    warn_count = 0
    pass_count = 0
    info_count = 0
    checks = []

    try:
        reader = csv.DictReader(io.StringIO(content))
        for row in reader:
            severity = (row.get("severity", "") or "").upper().strip()
            checks.append({
                "severity": severity,
                "id": row.get("check_id", ""),
                "name": row.get("check_name", ""),
                "result": row.get("result", ""),
                "description": row.get("description", ""),
            })

            if severity in ("VULN", "CRITICAL", "HIGH"):
                vuln_count += 1
            elif severity in ("WARN", "WARNING", "MEDIUM"):
                warn_count += 1
            elif severity in ("INFO",):
                info_count += 1
            elif severity in ("PASS", "GOOD", "OK"):
                pass_count += 1
            # "LOW" 는 의도적으로 무시 — 점검 스크립트가 Low 티어를 사용하지 않음.
    except Exception as e:
        result.status = "failed"
        result.error_message = f"CSV 파싱 오류: {e}"
        return result

    result.severity_high = vuln_count
    result.severity_medium = warn_count
    # severity_low 미사용 — Low 티어 없음.
    result.severity_low = 0
    result.info_count = info_count
    # 취약점 수에서 INFO 제외.
    result.vulnerabilities_found = vuln_count + warn_count
    result.checks = checks

    total = vuln_count + warn_count + pass_count + info_count
    result.result_summary = (
        f"총 {total}개 점검 항목 | "
        f"취약: {vuln_count}, 경고: {warn_count}, "
        f"통과: {pass_count}, 정보(참조): {info_count}"
    )

    return result
