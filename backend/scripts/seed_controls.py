"""
ISMS-P 인증 기준 전체 통제항목 시드 데이터
3개 영역, 21개 분류, 101개 통제항목
(ISMS-P 인증기준 안내서 2023.11.23 기준)
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.deps import SessionLocal
from app.models.control import ControlDomain, ControlCategory, ControlItem


def seed():
    db = SessionLocal()

    # === Domain 3 추가 (없는 경우) ===
    domain3 = db.query(ControlDomain).filter(ControlDomain.code == "C").first()
    if not domain3:
        domain3 = ControlDomain(
            code="C",
            name="개인정보 처리 단계별 요구사항",
            description="개인정보의 처리 단계(수집, 이용, 제공, 파기)별 요구사항",
            sort_order=3,
        )
        db.add(domain3)
        db.flush()
        print(f"Added domain: {domain3.code} - {domain3.name}")

    # === Domain 3 카테고리 추가 ===
    domain3_cats = [
        ("C-1", "개인정보 수집 시 보호조치", 1),
        ("C-2", "개인정보 보유 및 이용 시 보호조치", 2),
        ("C-3", "개인정보 제공 시 보호조치", 3),
        ("C-4", "개인정보 파기 시 보호조치", 4),
        ("C-5", "정보주체 권리보호", 5),
    ]
    for code, name, sort_order in domain3_cats:
        existing = db.query(ControlCategory).filter(ControlCategory.code == code).first()
        if not existing:
            cat = ControlCategory(
                code=code, name=name, domain_id=domain3.id, sort_order=sort_order
            )
            db.add(cat)
            print(f"Added category: {code} - {name}")
    db.flush()

    # 모든 카테고리 매핑
    cat_map = {c.code: c.id for c in db.query(ControlCategory).all()}

    # === 전체 101개 통제항목 (ISMS-P 인증기준 안내서 2023.11.23 기준) ===
    all_items = [
        # 1. 관리체계 수립 및 운영 (16개)
        # 1.1 관리체계 기반 마련 (6개)
        ("1.1.1", "경영진의 참여", "최고경영자는 정보보호 및 개인정보보호 관리체계의 수립과 운영활동 전반에 경영진의 참여가 이루어질 수 있도록 보고 및 의사결정 체계를 수립하여 운영하여야 한다.", cat_map["A-1"], True, False, 1),
        ("1.1.2", "최고책임자의 지정", "최고경영자는 정보보호 업무를 총괄하는 정보보호 최고책임자와 개인정보보호 업무를 총괄하는 개인정보 보호책임자를 지정하여야 한다.", cat_map["A-1"], True, False, 2),
        ("1.1.3", "조직 구성", "최고경영자는 정보보호와 개인정보보호의 효과적 구현을 위한 실무조직, 조직 전반의 정보보호와 개인정보보호 관련 주요 사항을 검토 및 의결할 수 있는 위원회, 전사적 보호활동을 위한 부서별 정보보호와 개인정보보호 담당자로 구성된 협의체를 구성하여 운영하여야 한다.", cat_map["A-1"], True, False, 3),
        ("1.1.4", "범위 설정", "조직의 핵심 서비스와 개인정보 처리 현황 등을 고려하여 관리체계 범위를 설정하여야 한다.", cat_map["A-1"], True, False, 4),
        ("1.1.5", "정책 수립", "관리체계 범위 내에서 정보보호와 개인정보보호 활동의 근거를 포함하는 최상위 수준의 정보보호 및 개인정보보호 정책과 시행문서를 수립하고, 그 내용을 관련 임직원 및 외부자에게 전달하여야 한다.", cat_map["A-1"], True, False, 5),
        ("1.1.6", "자원 할당", "정보보호와 개인정보보호 관리체계의 효과적 구현과 지속적 운영을 위하여 필요한 자원을 확보하고, 연도별 세부 추진계획을 수립·시행하여야 한다.", cat_map["A-1"], True, False, 6),
        # 1.2 위험 관리 (4개)
        ("1.2.1", "정보자산 식별", "조직의 업무특성에 따라 정보자산 분류기준을 수립하여 관리체계 범위 내 모든 정보자산을 식별·분류하고, 중요도를 산정한 후 그 목록을 최신으로 관리하여야 한다.", cat_map["A-2"], True, False, 7),
        ("1.2.2", "현황 및 흐름분석", "관리체계 전 영역에 대한 정보서비스 및 개인정보 처리 현황을 분석하고, 업무절차와 흐름을 파악하여 문서화하며, 이를 주기적으로 검토하여 최신성을 유지하여야 한다.", cat_map["A-2"], True, False, 8),
        ("1.2.3", "위험 평가", "조직의 특성에 적합한 위험관리 방법을 선정하고, 위험관리 계획에 따라 정기적으로 또는 필요한 시점에 위험평가를 수행한 후 그 결과에 따라 수용할 수 있는 위험수준을 정하고 경영진의 승인을 받아야 한다.", cat_map["A-2"], True, False, 9),
        ("1.2.4", "보호대책 선정", "위험평가 결과에 따라 식별된 위험에 대한 처리전략을 수립하고 보호대책을 선정하여 보호대책 이행계획을 수립하여야 한다.", cat_map["A-2"], True, False, 10),
        # 1.3 관리체계 운영 (3개)
        ("1.3.1", "보호대책 구현", "이행계획에 따라 보호대책을 효과적으로 구현하고 경영진은 이행결과의 정확성 및 효과성 여부를 확인하여야 한다.", cat_map["A-3"], True, False, 11),
        ("1.3.2", "보호대책 공유", "구현된 보호대책을 운영 또는 시행할 부서 및 담당자를 파악하고, 관련 내용을 공유하여야 한다.", cat_map["A-3"], True, False, 12),
        ("1.3.3", "운영현황 관리", "관리체계 운영활동의 수행 내역을 기록하고 현황을 관리하여야 한다.", cat_map["A-3"], True, False, 13),
        # 1.4 관리체계 점검 및 개선 (3개)
        ("1.4.1", "법적 요구사항 준수 검토", "조직이 준수하여야 하는 정보보호 및 개인정보보호 관련 법적 요구사항을 주기적으로 파악하여 규정에 반영하고, 준수 여부를 지속적으로 검토하여야 한다.", cat_map["A-4"], True, False, 14),
        ("1.4.2", "관리체계 점검", "관리체계가 내부 정책 및 법적 요구사항에 따라 적절하게 운영되고 있는지 독립성이 보장된 인력을 활용하여 주기적으로 점검하여야 한다.", cat_map["A-4"], True, False, 15),
        ("1.4.3", "관리체계 개선", "법적 요구사항 준수 검토, 관리체계 점검 등을 통해 발견된 문제점에 대한 원인을 분석하고 재발방지 대책을 수립·이행하여야 한다.", cat_map["A-4"], True, False, 16),
        # 2. 보호대책 요구사항 (64개)
        # 2.1 정책, 조직, 자산 관리 (3개)
        ("2.1.1", "정책의 유지관리", "정보보호 및 개인정보보호 정책과 시행문서는 법령 및 규제, 상위 조직의 정책 등에 따라 주기적으로 타당성을 검토하고 필요 시 개정하여야 한다.", cat_map["B-1"], True, False, 17),
        ("2.1.2", "조직의 유지관리", "정보보호 및 개인정보보호 조직의 구성과 운영에 관한 사항을 주기적으로 검토하여야 한다.", cat_map["B-1"], True, False, 18),
        ("2.1.3", "정보자산 관리", "정보자산의 분류 기준을 수립하고, 자산별 책임소재를 명확히 정의하여 관리하여야 한다.", cat_map["B-1"], True, False, 19),
        # 2.2 인적 보안 (6개)
        ("2.2.1", "주요 직무자 지정 및 관리", "주요 직무자를 지정하고 그에 따른 관리 방안을 수립·이행하여야 한다.", cat_map["B-2"], True, False, 20),
        ("2.2.2", "직무 분리", "직무의 중요도에 따라 겸직을 제한하는 등 직무 분리 기준을 수립하고 이를 적용하여야 한다.", cat_map["B-2"], True, False, 21),
        ("2.2.3", "보안 서약", "임직원 및 관련 외부자에게 비밀유지 등의 보안 서약을 받아야 한다.", cat_map["B-2"], True, False, 22),
        ("2.2.4", "인식제고 및 교육훈련", "임직원 및 관련 외부자에 대한 정보보호 인식제고 활동과 교육훈련을 실시하여야 한다.", cat_map["B-2"], True, False, 23),
        ("2.2.5", "퇴직 및 직무변경 관리", "퇴직 및 직무변경 시 자산의 반환, 접근권한의 회수, 비밀유지 등 필요한 보안조치를 이행하여야 한다.", cat_map["B-2"], True, False, 24),
        ("2.2.6", "보안 위반 시 조치", "임직원 및 관련 외부자가 보안 정책을 위반한 경우에 대한 처리 절차를 수립·이행하여야 한다.", cat_map["B-2"], True, False, 25),
        # 2.3 외부자 보안 (4개)
        ("2.3.1", "외부자 현황 관리", "업무 위탁, 시설 제공 등 외부 서비스를 이용하는 경우 외부자 현황을 관리하여야 한다.", cat_map["B-3"], True, False, 26),
        ("2.3.2", "외부자 계약 시 보안", "외부 서비스를 이용하거나 외부자에게 시설을 제공할 경우 정보보호 관련 사항을 계약서에 명시하여야 한다.", cat_map["B-3"], True, False, 27),
        ("2.3.3", "외부자 보안 이행 관리", "외부자의 보안 이행 여부를 주기적으로 점검하여야 한다.", cat_map["B-3"], True, False, 28),
        ("2.3.4", "외부자 계약 변경 및 만료 시 보안", "외부 서비스 계약이 변경 또는 만료될 경우 정보자산 반납, 접근권한 회수, 정보 삭제 등 보안조치를 이행하여야 한다.", cat_map["B-3"], True, False, 29),
        # 2.4 물리 보안 (7개)
        ("2.4.1", "보호구역 지정", "정보시스템 등 중요 자산을 보호하기 위해 보호구역을 지정하여야 한다.", cat_map["B-4"], True, False, 30),
        ("2.4.2", "출입통제", "보호구역에 대한 출입 통제 절차를 수립·이행하여야 한다.", cat_map["B-4"], True, False, 31),
        ("2.4.3", "정보시스템 보호", "정보시스템이 설치된 장소에 대해 환경적 위협으로부터 보호하여야 한다.", cat_map["B-4"], True, False, 32),
        ("2.4.4", "보호설비 운영", "보호구역 내 정보시스템의 안전한 운영을 위한 보호설비를 갖추어야 한다.", cat_map["B-4"], True, False, 33),
        ("2.4.5", "보호구역 내 작업", "보호구역 내에서의 작업에 대한 보안 절차를 수립·이행하여야 한다.", cat_map["B-4"], True, False, 34),
        ("2.4.6", "반출입 기기 통제", "보호구역 내로의 기기 및 저장매체의 반출입에 대한 통제 절차를 수립·이행하여야 한다.", cat_map["B-4"], True, False, 35),
        ("2.4.7", "업무환경 보안", "업무 환경에서 정보유출 방지를 위한 보안 대책을 마련하여야 한다.", cat_map["B-4"], True, False, 36),
        # 2.5 인증 및 권한관리 (6개)
        ("2.5.1", "사용자 계정 관리", "정보시스템과 개인정보 및 중요정보에 대한 사용자 계정의 등록·변경·삭제에 관한 절차를 수립·이행하여야 한다.", cat_map["B-5"], True, False, 37),
        ("2.5.2", "사용자 식별", "정보시스템에 접근하는 사용자를 고유하게 식별하여야 한다.", cat_map["B-5"], True, False, 38),
        ("2.5.3", "사용자 인증", "정보시스템 및 개인정보처리시스템에 대한 사용자 인증을 적용하여야 한다.", cat_map["B-5"], True, False, 39),
        ("2.5.4", "비밀번호 관리", "사용자 비밀번호에 대한 관리 절차를 수립·이행하여야 한다.", cat_map["B-5"], True, False, 40),
        ("2.5.5", "특수 계정 및 권한관리", "시스템 관리자 계정 등 특수 권한 계정에 대한 관리 절차를 수립·이행하여야 한다.", cat_map["B-5"], True, False, 41),
        ("2.5.6", "접근권한 검토", "사용자 접근권한의 적절성을 주기적으로 검토하여야 한다.", cat_map["B-5"], True, False, 42),
        # 2.6 접근통제 (7개)
        ("2.6.1", "네트워크 접근", "네트워크에 대한 비인가 접근을 통제하기 위한 정책을 수립·이행하여야 한다.", cat_map["B-6"], True, False, 43),
        ("2.6.2", "정보시스템 접근", "서버, 네트워크시스템 등 정보시스템에 대한 접근을 통제하여야 한다.", cat_map["B-6"], True, False, 44),
        ("2.6.3", "응용프로그램 접근", "응용프로그램에 대한 접근권한을 관리하여야 한다.", cat_map["B-6"], True, False, 45),
        ("2.6.4", "데이터베이스 접근", "데이터베이스에 대한 접근을 통제하여야 한다.", cat_map["B-6"], True, False, 46),
        ("2.6.5", "무선 네트워크 접근", "무선 네트워크에 대한 접근 통제 대책을 수립·이행하여야 한다.", cat_map["B-6"], True, False, 47),
        ("2.6.6", "원격접근 통제", "외부에서의 원격 접근에 대한 통제 대책을 수립·이행하여야 한다.", cat_map["B-6"], True, False, 48),
        ("2.6.7", "인터넷 접속 통제", "인터넷 접속에 대한 통제 대책을 수립·이행하여야 한다.", cat_map["B-6"], True, False, 49),
        # 2.7 암호화 적용 (2개)
        ("2.7.1", "암호정책 적용", "개인정보 및 중요정보 보호를 위한 암호화 정책을 수립하고 적용하여야 한다.", cat_map["B-7"], True, False, 50),
        ("2.7.2", "암호키 관리", "암호키의 생성, 이용, 보관, 배포, 파기에 관한 절차를 수립·이행하여야 한다.", cat_map["B-7"], True, False, 51),
        # 2.8 정보시스템 도입 및 개발 보안 (6개)
        ("2.8.1", "보안 요구사항 정의", "정보시스템의 도입·개발·변경 시 보안 요구사항을 정의하여야 한다.", cat_map["B-8"], True, False, 52),
        ("2.8.2", "보안 요구사항 검토 및 시험", "보안 요구사항의 이행 여부를 검토·시험하여야 한다.", cat_map["B-8"], True, False, 53),
        ("2.8.3", "시험과 운영 환경 분리", "개발 및 시험 시스템은 운영 시스템과 분리하여야 한다.", cat_map["B-8"], True, False, 54),
        ("2.8.4", "시험 데이터 보안", "시험 데이터의 생성과 이용 및 관리, 파기에 관한 절차를 수립·이행하여야 한다.", cat_map["B-8"], True, False, 55),
        ("2.8.5", "소스 프로그램 관리", "소스 프로그램에 대한 변경관리를 수행하고 접근을 통제하여야 한다.", cat_map["B-8"], True, False, 56),
        ("2.8.6", "운영환경 이관", "운영환경으로의 이관은 통제된 절차에 따라 수행하여야 한다.", cat_map["B-8"], True, False, 57),
        # 2.9 시스템 및 서비스 운영관리 (7개)
        ("2.9.1", "변경관리", "정보시스템 관련 자산의 모든 변경내역을 관리하여야 한다.", cat_map["B-9"], True, False, 58),
        ("2.9.2", "성능 및 장애관리", "정보시스템의 가용성을 보장하기 위해 성능 및 장애 관리 절차를 수립·이행하여야 한다.", cat_map["B-9"], True, False, 59),
        ("2.9.3", "백업 및 복구관리", "정보시스템의 백업 및 복구에 관한 절차를 수립·이행하여야 한다.", cat_map["B-9"], True, False, 60),
        ("2.9.4", "로그 및 접속기록 관리", "정보시스템의 로그 및 접속기록을 안전하게 보관·관리하여야 한다.", cat_map["B-9"], True, False, 61),
        ("2.9.5", "로그 및 접속기록 점검", "정보시스템의 로그 및 접속기록을 주기적으로 점검하여야 한다.", cat_map["B-9"], True, False, 62),
        ("2.9.6", "시간 동기화", "로그 및 접속기록의 정확성을 보장하기 위해 시간 동기화를 수행하여야 한다.", cat_map["B-9"], True, False, 63),
        ("2.9.7", "정보자산의 재사용 및 폐기", "정보자산의 재사용 및 폐기 시 정보를 안전하게 삭제하여야 한다.", cat_map["B-9"], True, False, 64),
        # 2.10 시스템 및 서비스 보안관리 (9개)
        ("2.10.1", "보안시스템 운영", "보안시스템의 효율적 운영을 위한 절차를 수립·이행하여야 한다.", cat_map["B-10"], True, False, 65),
        ("2.10.2", "클라우드 보안", "클라우드 서비스 이용 시 보안 요구사항을 반영하여야 한다.", cat_map["B-10"], True, False, 66),
        ("2.10.3", "공개서버 보안", "외부에 공개되는 서버에 대한 보안 대책을 수립·이행하여야 한다.", cat_map["B-10"], True, False, 67),
        ("2.10.4", "전자거래 및 핀테크 보안", "전자거래 및 핀테크 서비스에 대한 보안 대책을 마련하여야 한다.", cat_map["B-10"], True, False, 68),
        ("2.10.5", "정보전송 보안", "타 조직에 정보를 전송할 경우 보안 대책을 수립·이행하여야 한다.", cat_map["B-10"], True, False, 69),
        ("2.10.6", "업무용 단말기기 보안", "업무용 단말기기의 보안 대책을 수립·이행하여야 한다.", cat_map["B-10"], True, False, 70),
        ("2.10.7", "보조저장매체 관리", "보조저장매체에 대한 관리 절차를 수립·이행하여야 한다.", cat_map["B-10"], True, False, 71),
        ("2.10.8", "패치관리", "소프트웨어 보안 패치에 관한 절차를 수립·이행하여야 한다.", cat_map["B-10"], True, False, 72),
        ("2.10.9", "악성코드 통제", "악성코드로부터 정보시스템을 보호하기 위한 대책을 수립·이행하여야 한다.", cat_map["B-10"], True, False, 73),
        # 2.11 사고 예방 및 대응 (5개)
        ("2.11.1", "사고 예방 및 대응체계 구축", "침해사고 및 개인정보 유출사고에 대한 예방 및 대응 체계를 구축하여야 한다.", cat_map["B-11"], True, False, 74),
        ("2.11.2", "취약점 점검 및 조치", "정보시스템의 취약점을 주기적으로 점검하고 조치하여야 한다.", cat_map["B-11"], True, False, 75),
        ("2.11.3", "이상행위 분석 및 모니터링", "네트워크 및 시스템에 대한 이상행위를 모니터링하여야 한다.", cat_map["B-11"], True, False, 76),
        ("2.11.4", "사고 대응 훈련 및 개선", "침해사고 대응 절차에 따른 모의훈련을 실시하고 개선하여야 한다.", cat_map["B-11"], True, False, 77),
        ("2.11.5", "사고 대응 및 복구", "침해사고 발생 시 신속하게 대응하고 복구하여야 한다.", cat_map["B-11"], True, False, 78),
        # 2.12 재해복구 (2개)
        ("2.12.1", "재해·재난 대비 안전조치", "재해·재난 발생 시 핵심 서비스의 연속성을 보장하기 위한 대책을 수립·이행하여야 한다.", cat_map["B-12"], True, False, 79),
        ("2.12.2", "재해 복구 시험 및 개선", "재해 복구 계획의 적정성을 시험하고 개선하여야 한다.", cat_map["B-12"], True, False, 80),
        # 3. 개인정보 처리 단계별 요구사항 (21개)
        # 3.1 개인정보 수집 시 보호조치 (7개)
        ("3.1.1", "개인정보 수집·이용", "개인정보를 수집하는 경우 그 목적을 명확히 하고, 목적에 필요한 최소한의 개인정보를 적법하고 정당하게 수집하여야 한다.", cat_map["C-1"], True, True, 81),
        ("3.1.2", "개인정보 수집 제한", "개인정보를 수집하는 경우 그 목적에 필요한 최소한의 정보만을 수집하여야 하며, 필요한 최소한의 정보 외의 개인정보를 수집하는 경우에는 동의 거부의 권리 등을 알리고 동의를 받아야 한다.", cat_map["C-1"], True, True, 82),
        ("3.1.3", "주민등록번호 처리 제한", "주민등록번호의 처리는 법적 근거가 있는 경우에만 수집하여야 한다.", cat_map["C-1"], True, True, 83),
        ("3.1.4", "민감정보 및 고유식별정보의 처리 제한", "민감정보 및 고유식별정보의 처리를 제한하여야 한다.", cat_map["C-1"], True, True, 84),
        ("3.1.5", "개인정보 간접수집", "정보주체 이외로부터 개인정보를 수집하거나 제공받는 경우에는 법적 요구사항에 따라 보호조치를 취하여야 한다.", cat_map["C-1"], True, True, 85),
        ("3.1.6", "영상정보처리기기 설치·운영", "영상정보처리기기의 설치·운영에 관한 절차를 수립·이행하여야 한다.", cat_map["C-1"], True, True, 86),
        ("3.1.7", "마케팅 목적의 개인정보 수집·이용", "홍보·마케팅 목적으로 개인정보를 수집·이용하는 경우 법적 요구사항에 따라 보호조치를 취하여야 한다.", cat_map["C-1"], True, True, 87),
        # 3.2 개인정보 보유 및 이용 시 보호조치 (5개)
        ("3.2.1", "개인정보 현황관리", "수집·보유하고 있는 개인정보의 현황을 파악하고 관리하여야 한다.", cat_map["C-2"], True, True, 88),
        ("3.2.2", "개인정보 품질보장", "수집된 개인정보의 정확성·완전성을 보장하여야 한다.", cat_map["C-2"], True, True, 89),
        ("3.2.3", "이용자 단말기 접근 보호", "정보주체의 이동통신단말장치에 접근하는 경우 보호조치를 취하여야 한다.", cat_map["C-2"], True, True, 90),
        ("3.2.4", "개인정보 목적 외 이용 및 제공", "개인정보를 목적 외로 이용하거나 제공하지 않아야 한다.", cat_map["C-2"], True, True, 91),
        ("3.2.5", "가명정보 처리", "가명정보를 처리하는 경우 목적 제한, 가명처리 방법 및 기준 등 관련 법령의 요구사항을 준수하여야 한다.", cat_map["C-2"], True, True, 92),
        # 3.3 개인정보 제공 시 보호조치 (4개)
        ("3.3.1", "개인정보 제3자 제공", "개인정보를 제3자에게 제공하는 경우 보호조치를 취하여야 한다.", cat_map["C-3"], True, True, 93),
        ("3.3.2", "개인정보 처리 업무 위탁", "개인정보 처리 업무를 위탁하는 경우 보호조치를 취하여야 한다.", cat_map["C-3"], True, True, 94),
        ("3.3.3", "영업의 양도 등에 따른 개인정보 이전", "영업의 양도·합병 등에 따른 개인정보 이전 시 보호조치를 취하여야 한다.", cat_map["C-3"], True, True, 95),
        ("3.3.4", "개인정보 국외이전", "개인정보를 국외에 이전하는 경우 보호조치를 취하여야 한다.", cat_map["C-3"], True, True, 96),
        # 3.4 개인정보 파기 시 보호조치 (2개)
        ("3.4.1", "개인정보 파기", "개인정보의 보유기간 경과, 처리 목적 달성 등 파기 사유가 발생한 경우 파기하여야 한다.", cat_map["C-4"], True, True, 97),
        ("3.4.2", "처리목적 달성 후 보유 시 조치", "처리목적 달성 후에도 관련 법령에 따라 보유하는 경우 보호조치를 취하여야 한다.", cat_map["C-4"], True, True, 98),
        # 3.5 정보주체 권리보호 (3개)
        ("3.5.1", "개인정보 처리방침 공개", "개인정보처리방침을 수립하여 공개하여야 한다.", cat_map["C-5"], True, True, 99),
        ("3.5.2", "정보주체 권리보장", "정보주체의 권리(열람, 정정·삭제, 처리정지 요구 등)를 보장하여야 한다.", cat_map["C-5"], True, True, 100),
        ("3.5.3", "정보주체에 대한 통지", "개인정보 이용내역 및 유출사고 등에 대하여 정보주체에게 통지하여야 한다.", cat_map["C-5"], True, True, 101),
    ]

    added = 0
    updated = 0
    skipped = 0

    for code, title, desc, cat_id, req, pi, sorder in all_items:
        existing = db.query(ControlItem).filter(ControlItem.code == code).first()
        if existing:
            # Update description and sort_order if different
            changed = False
            if existing.title != title:
                existing.title = title
                changed = True
            if existing.description != desc:
                existing.description = desc
                changed = True
            if existing.sort_order != sorder:
                existing.sort_order = sorder
                changed = True
            if existing.category_id != cat_id:
                existing.category_id = cat_id
                changed = True
            if existing.is_personal_info != pi:
                existing.is_personal_info = pi
                changed = True
            if changed:
                updated += 1
            else:
                skipped += 1
            continue

        item = ControlItem(
            code=code,
            title=title,
            description=desc,
            category_id=cat_id,
            is_required=req,
            is_personal_info=pi,
            sort_order=sorder,
        )
        db.add(item)
        added += 1

    db.commit()

    # === 주요 확인사항, 관련 법규, 증거자료 예시 로드 ===
    details_file = os.path.join(os.path.dirname(__file__), "seed_control_details.json")
    if os.path.exists(details_file):
        import json
        with open(details_file, encoding="utf-8") as f:
            details = json.load(f)
        details_updated = 0
        for code, data in details.items():
            item = db.query(ControlItem).filter(ControlItem.code == code).first()
            if item:
                changed = False
                if data.get("key_checks") and not item.key_checks:
                    item.key_checks = data["key_checks"]
                    changed = True
                if data.get("related_laws") and not item.related_laws:
                    item.related_laws = data["related_laws"]
                    changed = True
                if data.get("evidence_examples") and not item.evidence_examples:
                    item.evidence_examples = data["evidence_examples"]
                    changed = True
                if changed:
                    details_updated += 1
        db.commit()
        print(f"Control details updated: {details_updated}")

    total = db.query(ControlItem).count()
    domains_count = db.query(ControlDomain).count()
    cats_count = db.query(ControlCategory).count()
    print(f"Domains: {domains_count}, Categories: {cats_count}")
    print(f"Added: {added}, Updated: {updated}, Skipped: {skipped}")
    print(f"Total control items: {total}")
    db.close()


if __name__ == "__main__":
    seed()
