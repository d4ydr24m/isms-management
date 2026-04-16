"""
통제항목-증적출처 기본 연결 시드 데이터

ISMS-P 통제항목과 시스템 모듈 간의 기본 증적출처 매핑을 생성합니다.
여러 번 실행해도 안전합니다 (중복 건너뜀).
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.deps import SessionLocal
from app.models.control import ControlItem
from app.models.control_evidence_link import ControlEvidenceLink

# 통제항목 코드 → 증적출처 매핑
# (control_code, source_type, source_label, source_url, description)
DEFAULT_LINKS = [
    # 1.1.2 최고책임자의 지정
    ("1.1.2", "personnel", "담당자 관리", "/personnel", "정보보호 최고책임자 및 개인정보 보호책임자 지정 현황"),

    # 1.1.3 조직 구성
    ("1.1.3", "departments", "부서 관리", "/departments", "정보보호 조직 구성 현황"),
    ("1.1.3", "personnel", "담당자 관리", "/personnel", "정보보호 역할 및 책임자 현황"),

    # 1.1.4 범위 설정
    ("1.1.4", "isms_scope", "인증 범위 관리", "/isms-scope", "ISMS 인증 범위 설정 및 변경 이력"),

    # 1.1.6 자원 할당
    ("1.1.6", "assets", "자산 목록", "/assets", "관리체계 범위 내 정보자산 현황"),
    ("1.1.6", "personnel", "담당자 관리", "/personnel", "인력 자원 관리 현황"),

    # 1.2.1 정보자산 식별
    ("1.2.1", "assets", "자산 목록", "/assets", "정보자산 식별 및 분류 현황"),
    ("1.2.1", "assets", "자산 분류 관리", "/assets/categories", "자산 분류 체계"),

    # 1.2.3 위험 평가
    ("1.2.3", "risks", "위험 시나리오", "/risk", "위험 평가 시나리오 및 결과"),

    # 1.2.4 보호대책 선정
    ("1.2.4", "risks", "위험 처리 계획", "/risk/treatments", "위험 처리 계획 및 이행 현황"),
    ("1.2.4", "risks", "SOA 관리", "/risk/soa", "적용성 보고서 (Statement of Applicability)"),

    # 1.3.1 보호대책 구현
    ("1.3.1", "risks", "위험 처리 계획", "/risk/treatments", "보호대책 이행 계획 및 진행 현황"),
    ("1.3.1", "risks", "SOA 관리", "/risk/soa", "보호대책 적용 현황"),

    # 1.3.3 운영현황 관리
    ("1.3.3", "evidence", "증적 관리", "/evidence", "관리체계 운영 활동 기록"),

    # 1.4.2 관리체계 점검
    ("1.4.2", "audits", "감사 계획", "/audits", "내부 감사 계획 및 결과"),
    ("1.4.2", "audits", "부적합 관리", "/non-conformities", "점검 발견사항 및 부적합 사항"),

    # 1.4.3 관리체계 개선
    ("1.4.3", "audits", "부적합 관리", "/non-conformities", "부적합 사항 시정 조치 및 재발방지 대책"),

    # 2.1.1 정책의 유지관리
    ("2.1.1", "evidence", "증적 관리", "/evidence", "정보보호 정책 및 시행문서"),

    # 2.1.2 조직의 유지관리
    ("2.1.2", "departments", "부서 관리", "/departments", "정보보호 조직 구성"),
    ("2.1.2", "personnel", "담당자 관리", "/personnel", "정보보호 담당자 현황"),

    # 2.1.3 정보자산 관리
    ("2.1.3", "assets", "자산 목록", "/assets", "정보자산 현황 관리"),
    ("2.1.3", "assets", "자산 분류 관리", "/assets/categories", "자산 분류 기준 및 체계"),

    # 2.5.1 사용자 계정 관리
    ("2.5.1", "personnel", "담당자 관리", "/personnel", "사용자 계정 등록/변경/삭제 현황"),

    # 2.11.1 사고 예방 및 대응체계 구축 - 취약점 점검
    ("2.11.1", "vuln_check", "취약점 점검", "/risk/vuln-check", "취약점 점검 스크립트 및 실행 결과"),
    ("2.11.1", "vuln_check", "취약점 DB", "/risk/vulnerabilities", "취약점 데이터베이스"),
]


def seed():
    db = SessionLocal()
    try:
        # 통제항목 코드 → ID 매핑
        items = db.query(ControlItem).all()
        code_to_id = {item.code: item.id for item in items}

        created = 0
        skipped = 0

        for code, source_type, source_label, source_url, description in DEFAULT_LINKS:
            control_id = code_to_id.get(code)
            if not control_id:
                print(f"  [SKIP] Control {code} not found")
                skipped += 1
                continue

            # 중복 확인
            existing = (
                db.query(ControlEvidenceLink)
                .filter(
                    ControlEvidenceLink.control_item_id == control_id,
                    ControlEvidenceLink.source_type == source_type,
                    ControlEvidenceLink.source_url == source_url,
                )
                .first()
            )
            if existing:
                skipped += 1
                continue

            link = ControlEvidenceLink(
                control_item_id=control_id,
                source_type=source_type,
                source_label=source_label,
                source_url=source_url,
                description=description,
                created_by=None,  # system-generated
            )
            db.add(link)
            created += 1

        db.commit()
        print(f"Evidence links: {created} created, {skipped} skipped")

    except Exception as e:
        db.rollback()
        print(f"Error seeding evidence links: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
