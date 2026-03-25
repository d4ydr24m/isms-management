-- =====================================================
-- 위협 카테고리 (Threat Categories)
-- =====================================================
INSERT INTO threat_categories (code, name, description, sort_order, is_active, created_at, updated_at) VALUES
('TC-NAT', '자연재해', '자연적으로 발생하는 재해 및 환경적 위협', 1, true, NOW(), NOW()),
('TC-PHY', '물리적 위협', '시설, 장비 등에 대한 물리적 위협', 2, true, NOW(), NOW()),
('TC-TEC', '기술적 위협', '시스템, 네트워크, 소프트웨어 관련 기술적 위협', 3, true, NOW(), NOW()),
('TC-HUM', '인적 위협', '내부자 및 외부자에 의한 고의적/비고의적 위협', 4, true, NOW(), NOW()),
('TC-OPS', '운영 위협', '운영 및 관리 절차상의 위협', 5, true, NOW(), NOW()),
('TC-LEG', '법적/규제 위협', '법규 변경, 규제 위반 등에 따른 위협', 6, true, NOW(), NOW());

-- =====================================================
-- 위협 (Threats) - 자연재해
-- =====================================================
INSERT INTO threats (code, name, description, category_id, threat_level, is_custom, is_active, created_at, updated_at) VALUES
('T-NAT-001', '지진', '지진 발생으로 인한 시설 및 장비 손상, 서비스 중단', (SELECT id FROM threat_categories WHERE code='TC-NAT'), 3, false, true, NOW(), NOW()),
('T-NAT-002', '홍수/침수', '집중호우, 태풍 등으로 인한 시설 침수 및 장비 손상', (SELECT id FROM threat_categories WHERE code='TC-NAT'), 3, false, true, NOW(), NOW()),
('T-NAT-003', '화재', '화재 발생으로 인한 시설 및 장비 소실', (SELECT id FROM threat_categories WHERE code='TC-NAT'), 4, false, true, NOW(), NOW()),
('T-NAT-004', '낙뢰', '낙뢰로 인한 전원 장애 및 장비 손상', (SELECT id FROM threat_categories WHERE code='TC-NAT'), 2, false, true, NOW(), NOW()),
('T-NAT-005', '정전/전력 장애', '외부 전력 공급 중단으로 인한 시스템 가용성 저하', (SELECT id FROM threat_categories WHERE code='TC-NAT'), 4, false, true, NOW(), NOW()),
('T-NAT-006', '온도/습도 이상', '공조 시스템 장애로 인한 장비 과열 및 고장', (SELECT id FROM threat_categories WHERE code='TC-NAT'), 3, false, true, NOW(), NOW());

-- 물리적 위협
INSERT INTO threats (code, name, description, category_id, threat_level, is_custom, is_active, created_at, updated_at) VALUES
('T-PHY-001', '비인가 물리적 접근', '보호구역에 대한 비인가자의 무단 침입', (SELECT id FROM threat_categories WHERE code='TC-PHY'), 4, false, true, NOW(), NOW()),
('T-PHY-002', '장비 도난', '서버, PC, 저장매체 등 정보 장비의 물리적 도난', (SELECT id FROM threat_categories WHERE code='TC-PHY'), 4, false, true, NOW(), NOW()),
('T-PHY-003', '장비 파손/훼손', '고의 또는 사고에 의한 정보 장비의 물리적 손상', (SELECT id FROM threat_categories WHERE code='TC-PHY'), 3, false, true, NOW(), NOW()),
('T-PHY-004', '도청/감청', '통신 회선 또는 시설 내 도청 장치 설치', (SELECT id FROM threat_categories WHERE code='TC-PHY'), 3, false, true, NOW(), NOW()),
('T-PHY-005', '문서/매체 유출', '중요 문서 및 저장매체의 외부 반출 또는 유실', (SELECT id FROM threat_categories WHERE code='TC-PHY'), 4, false, true, NOW(), NOW()),
('T-PHY-006', '출입 통제 우회', '출입 통제 시스템의 우회 또는 테일게이팅', (SELECT id FROM threat_categories WHERE code='TC-PHY'), 3, false, true, NOW(), NOW());

-- 기술적 위협
INSERT INTO threats (code, name, description, category_id, threat_level, is_custom, is_active, created_at, updated_at) VALUES
('T-TEC-001', '악성코드 감염', '랜섬웨어, 바이러스, 웜, 트로이목마 등 악성코드에 의한 시스템 감염', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 5, false, true, NOW(), NOW()),
('T-TEC-002', '랜섬웨어 공격', '파일 암호화 및 금전 요구를 목적으로 한 랜섬웨어 공격', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 5, false, true, NOW(), NOW()),
('T-TEC-003', '해킹/침투', '외부 해커에 의한 시스템 침투 및 정보 탈취', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 5, false, true, NOW(), NOW()),
('T-TEC-004', 'DDoS 공격', '서비스 거부 공격으로 인한 시스템 가용성 저하', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 4, false, true, NOW(), NOW()),
('T-TEC-005', 'SQL Injection', '웹 애플리케이션의 SQL 인젝션 공격을 통한 데이터 유출', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 5, false, true, NOW(), NOW()),
('T-TEC-006', 'XSS 공격', '크로스사이트 스크립팅을 통한 사용자 세션 탈취', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 4, false, true, NOW(), NOW()),
('T-TEC-007', '피싱/스피어피싱', '이메일, 문자 등을 통한 피싱 공격으로 인증 정보 탈취', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 5, false, true, NOW(), NOW()),
('T-TEC-008', '제로데이 취약점 공격', '공개되지 않은 소프트웨어 취약점을 이용한 공격', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 5, false, true, NOW(), NOW()),
('T-TEC-009', '공급망 공격', '소프트웨어 공급망을 통한 악성코드 삽입 또는 변조', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 5, false, true, NOW(), NOW()),
('T-TEC-010', 'API 공격', 'API 취약점을 이용한 비인가 데이터 접근 및 조작', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 4, false, true, NOW(), NOW()),
('T-TEC-011', '클라우드 설정 오류 악용', '클라우드 서비스의 설정 오류를 통한 정보 유출', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 4, false, true, NOW(), NOW()),
('T-TEC-012', '무선 네트워크 침투', '무선 네트워크의 취약점을 이용한 비인가 접근', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 3, false, true, NOW(), NOW()),
('T-TEC-013', '암호화 공격', '약한 암호 알고리즘 또는 키 관리 취약점을 이용한 복호화', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 4, false, true, NOW(), NOW()),
('T-TEC-014', '세션 하이재킹', '사용자 세션을 탈취하여 비인가 접근 수행', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 4, false, true, NOW(), NOW()),
('T-TEC-015', 'AI/딥페이크 공격', 'AI 기술을 활용한 사회공학적 공격 및 신원 위조', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 4, false, true, NOW(), NOW()),
('T-TEC-016', '시스템/하드웨어 장애', '서버, 스토리지, 네트워크 장비의 고장 또는 오동작', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 3, false, true, NOW(), NOW()),
('T-TEC-017', '데이터 손상/유실', '하드웨어 장애, 소프트웨어 오류 등에 의한 데이터 손실', (SELECT id FROM threat_categories WHERE code='TC-TEC'), 4, false, true, NOW(), NOW());

-- 인적 위협
INSERT INTO threats (code, name, description, category_id, threat_level, is_custom, is_active, created_at, updated_at) VALUES
('T-HUM-001', '내부자 정보 유출', '임직원에 의한 고의적 기밀정보 또는 개인정보 유출', (SELECT id FROM threat_categories WHERE code='TC-HUM'), 5, false, true, NOW(), NOW()),
('T-HUM-002', '내부자 시스템 파괴', '불만 직원 등에 의한 시스템 또는 데이터 파괴 행위', (SELECT id FROM threat_categories WHERE code='TC-HUM'), 4, false, true, NOW(), NOW()),
('T-HUM-003', '사회공학 공격', '전화, 이메일 등을 통한 심리적 조작으로 정보 획득', (SELECT id FROM threat_categories WHERE code='TC-HUM'), 4, false, true, NOW(), NOW()),
('T-HUM-004', '운영 실수', '관리자의 설정 오류, 잘못된 명령 실행 등 비고의적 실수', (SELECT id FROM threat_categories WHERE code='TC-HUM'), 3, false, true, NOW(), NOW()),
('T-HUM-005', '보안 정책 위반', '보안 규정을 무시하거나 우회하는 행위', (SELECT id FROM threat_categories WHERE code='TC-HUM'), 3, false, true, NOW(), NOW()),
('T-HUM-006', '퇴직자 정보 유출', '퇴직 시 접근권한 미회수로 인한 정보 유출', (SELECT id FROM threat_categories WHERE code='TC-HUM'), 4, false, true, NOW(), NOW()),
('T-HUM-007', '외부 위탁업체 보안 사고', '외부 위탁업체의 보안 관리 부실로 인한 정보 유출', (SELECT id FROM threat_categories WHERE code='TC-HUM'), 4, false, true, NOW(), NOW()),
('T-HUM-008', '비인가 소프트웨어 사용', '승인되지 않은 소프트웨어 설치 및 사용', (SELECT id FROM threat_categories WHERE code='TC-HUM'), 3, false, true, NOW(), NOW());

-- 운영 위협
INSERT INTO threats (code, name, description, category_id, threat_level, is_custom, is_active, created_at, updated_at) VALUES
('T-OPS-001', '백업 실패', '백업 절차 미이행 또는 백업 데이터 손상', (SELECT id FROM threat_categories WHERE code='TC-OPS'), 4, false, true, NOW(), NOW()),
('T-OPS-002', '패치 미적용', '보안 패치 미적용으로 인한 알려진 취약점 노출', (SELECT id FROM threat_categories WHERE code='TC-OPS'), 4, false, true, NOW(), NOW()),
('T-OPS-003', '로그 관리 부실', '보안 로그 미수집, 미점검으로 인한 침해 탐지 실패', (SELECT id FROM threat_categories WHERE code='TC-OPS'), 3, false, true, NOW(), NOW()),
('T-OPS-004', '변경 관리 실패', '시스템 변경 시 부적절한 절차로 인한 장애 발생', (SELECT id FROM threat_categories WHERE code='TC-OPS'), 3, false, true, NOW(), NOW()),
('T-OPS-005', '재해복구 실패', '재해복구 계획 부재 또는 미이행으로 인한 서비스 중단 장기화', (SELECT id FROM threat_categories WHERE code='TC-OPS'), 4, false, true, NOW(), NOW());

-- 법적/규제 위협
INSERT INTO threats (code, name, description, category_id, threat_level, is_custom, is_active, created_at, updated_at) VALUES
('T-LEG-001', '개인정보보호법 위반', '개인정보 수집/이용/제공/파기 절차 위반으로 인한 법적 제재', (SELECT id FROM threat_categories WHERE code='TC-LEG'), 5, false, true, NOW(), NOW()),
('T-LEG-002', '정보통신망법 위반', '정보통신망 이용촉진 및 정보보호 등에 관한 법률 위반', (SELECT id FROM threat_categories WHERE code='TC-LEG'), 5, false, true, NOW(), NOW()),
('T-LEG-003', 'ISMS-P 인증 취소', '중대 결함 발견 시 ISMS-P 인증 취소 위험', (SELECT id FROM threat_categories WHERE code='TC-LEG'), 5, false, true, NOW(), NOW()),
('T-LEG-004', '규제 변경', '법규 개정에 따른 추가 보안 요구사항 발생', (SELECT id FROM threat_categories WHERE code='TC-LEG'), 3, false, true, NOW(), NOW());

-- =====================================================
-- 취약점 카테고리 (Vulnerability Categories)
-- =====================================================
INSERT INTO vulnerability_categories (code, name, description, sort_order, is_active, created_at, updated_at) VALUES
('VC-MGT', '관리적 취약점', '보안 정책, 조직, 인력 관리 등 관리적 측면의 취약점', 1, true, NOW(), NOW()),
('VC-TEC', '기술적 취약점', '시스템, 네트워크, 애플리케이션 등 기술적 측면의 취약점', 2, true, NOW(), NOW()),
('VC-PHY', '물리적 취약점', '시설, 장비, 환경 등 물리적 측면의 취약점', 3, true, NOW(), NOW()),
('VC-OPS', '운영 취약점', '시스템 운영 및 관리 절차상의 취약점', 4, true, NOW(), NOW()),
('VC-WEB', '웹 애플리케이션 취약점', 'OWASP Top 10 2025 기반 웹 애플리케이션 보안 취약점', 5, true, NOW(), NOW()),
('VC-CLD', '클라우드 취약점', '클라우드 환경 특유의 보안 취약점', 6, true, NOW(), NOW());

-- 관리적 취약점
INSERT INTO vulnerabilities (code, name, description, category_id, severity, is_custom, is_active, created_at, updated_at) VALUES
('V-MGT-001', '보안 정책 부재/미흡', '정보보호 정책이 수립되지 않았거나 최신 상태로 유지되지 않음', (SELECT id FROM vulnerability_categories WHERE code='VC-MGT'), 4, false, true, NOW(), NOW()),
('V-MGT-002', '보안 조직 미구성', '정보보호 전담 조직이 구성되지 않거나 역할이 불명확함', (SELECT id FROM vulnerability_categories WHERE code='VC-MGT'), 3, false, true, NOW(), NOW()),
('V-MGT-003', '보안 교육 미실시', '임직원 대상 정보보호 인식제고 교육이 실시되지 않음', (SELECT id FROM vulnerability_categories WHERE code='VC-MGT'), 3, false, true, NOW(), NOW()),
('V-MGT-004', '위험평가 미수행', '정기적인 위험평가가 수행되지 않거나 결과가 반영되지 않음', (SELECT id FROM vulnerability_categories WHERE code='VC-MGT'), 4, false, true, NOW(), NOW()),
('V-MGT-005', '보안 서약 미이행', '임직원 및 외부자에 대한 보안 서약이 이루어지지 않음', (SELECT id FROM vulnerability_categories WHERE code='VC-MGT'), 3, false, true, NOW(), NOW()),
('V-MGT-006', '외부자 보안 관리 미흡', '외부 위탁업체에 대한 보안 점검 및 관리가 부족함', (SELECT id FROM vulnerability_categories WHERE code='VC-MGT'), 4, false, true, NOW(), NOW()),
('V-MGT-007', '개인정보 처리방침 미비', '개인정보 처리방침이 법적 요구사항을 충족하지 못함', (SELECT id FROM vulnerability_categories WHERE code='VC-MGT'), 4, false, true, NOW(), NOW()),
('V-MGT-008', '내부감사 미실시', '정보보호 관리체계에 대한 내부 점검이 실시되지 않음', (SELECT id FROM vulnerability_categories WHERE code='VC-MGT'), 3, false, true, NOW(), NOW());

-- 기술적 취약점
INSERT INTO vulnerabilities (code, name, description, category_id, severity, is_custom, is_active, created_at, updated_at) VALUES
('V-TEC-001', '계정/비밀번호 취약점', '기본 계정 사용, 약한 비밀번호 정책, 공유 계정 사용', (SELECT id FROM vulnerability_categories WHERE code='VC-TEC'), 5, false, true, NOW(), NOW()),
('V-TEC-002', '불필요한 서비스 활성화', '사용하지 않는 포트 및 서비스가 활성화되어 있음', (SELECT id FROM vulnerability_categories WHERE code='VC-TEC'), 3, false, true, NOW(), NOW()),
('V-TEC-003', '암호화 미적용', '중요정보 전송 및 저장 시 암호화가 적용되지 않음', (SELECT id FROM vulnerability_categories WHERE code='VC-TEC'), 5, false, true, NOW(), NOW()),
('V-TEC-004', '접근제어 미흡', 'IP 기반 접근제어, 네트워크 분리 등이 적용되지 않음', (SELECT id FROM vulnerability_categories WHERE code='VC-TEC'), 4, false, true, NOW(), NOW()),
('V-TEC-005', 'OS 보안 패치 미적용', '운영체제의 보안 업데이트가 적시에 적용되지 않음', (SELECT id FROM vulnerability_categories WHERE code='VC-TEC'), 5, false, true, NOW(), NOW()),
('V-TEC-006', 'DB 보안 설정 미흡', '데이터베이스 접근제어, 감사, 암호화 설정이 부족함', (SELECT id FROM vulnerability_categories WHERE code='VC-TEC'), 4, false, true, NOW(), NOW()),
('V-TEC-007', '무선 네트워크 보안 미흡', 'WPA3 미적용, 비인가 AP 탐지 부재 등', (SELECT id FROM vulnerability_categories WHERE code='VC-TEC'), 3, false, true, NOW(), NOW()),
('V-TEC-008', 'VPN/원격접근 취약점', '원격 접근 시 다중인증 미적용, VPN 설정 오류', (SELECT id FROM vulnerability_categories WHERE code='VC-TEC'), 4, false, true, NOW(), NOW()),
('V-TEC-009', '이메일 보안 미흡', 'SPF/DKIM/DMARC 미설정, 첨부파일 검사 미수행', (SELECT id FROM vulnerability_categories WHERE code='VC-TEC'), 3, false, true, NOW(), NOW()),
('V-TEC-010', '엔드포인트 보안 미흡', '백신 미설치, EDR 미운영, USB 통제 미적용', (SELECT id FROM vulnerability_categories WHERE code='VC-TEC'), 4, false, true, NOW(), NOW()),
('V-TEC-011', 'MFA 미적용', '중요 시스템에 대한 다중인증이 적용되지 않음', (SELECT id FROM vulnerability_categories WHERE code='VC-TEC'), 4, false, true, NOW(), NOW()),
('V-TEC-012', '로그 수집/보관 미흡', '보안 로그가 충분히 수집되지 않거나 보관 기간이 부족함', (SELECT id FROM vulnerability_categories WHERE code='VC-TEC'), 3, false, true, NOW(), NOW());

-- 물리적 취약점
INSERT INTO vulnerabilities (code, name, description, category_id, severity, is_custom, is_active, created_at, updated_at) VALUES
('V-PHY-001', '출입 통제 미흡', '보호구역에 대한 출입 통제가 제대로 이루어지지 않음', (SELECT id FROM vulnerability_categories WHERE code='VC-PHY'), 4, false, true, NOW(), NOW()),
('V-PHY-002', 'CCTV 사각지대', '보안 카메라의 사각지대가 존재하거나 녹화가 정상 작동하지 않음', (SELECT id FROM vulnerability_categories WHERE code='VC-PHY'), 3, false, true, NOW(), NOW()),
('V-PHY-003', '보호설비 부족', 'UPS, 항온항습기, 소화설비 등 보호설비가 부족함', (SELECT id FROM vulnerability_categories WHERE code='VC-PHY'), 3, false, true, NOW(), NOW()),
('V-PHY-004', '반출입 통제 미흡', '장비 및 저장매체의 반출입에 대한 통제가 미흡함', (SELECT id FROM vulnerability_categories WHERE code='VC-PHY'), 3, false, true, NOW(), NOW()),
('V-PHY-005', '클린데스크 미준수', '업무 종료 후 중요 문서가 방치되어 있음', (SELECT id FROM vulnerability_categories WHERE code='VC-PHY'), 2, false, true, NOW(), NOW());

-- 운영 취약점
INSERT INTO vulnerabilities (code, name, description, category_id, severity, is_custom, is_active, created_at, updated_at) VALUES
('V-OPS-001', '백업 체계 미흡', '정기적인 백업이 수행되지 않거나 복구 테스트가 미실시', (SELECT id FROM vulnerability_categories WHERE code='VC-OPS'), 4, false, true, NOW(), NOW()),
('V-OPS-002', '변경관리 절차 부재', '시스템 변경 시 검토, 승인, 테스트 절차가 부재함', (SELECT id FROM vulnerability_categories WHERE code='VC-OPS'), 3, false, true, NOW(), NOW()),
('V-OPS-003', '시험/운영환경 미분리', '개발/테스트 환경과 운영 환경이 분리되지 않음', (SELECT id FROM vulnerability_categories WHERE code='VC-OPS'), 4, false, true, NOW(), NOW()),
('V-OPS-004', '침해사고 대응체계 미흡', '침해사고 대응 절차 부재 또는 모의훈련 미실시', (SELECT id FROM vulnerability_categories WHERE code='VC-OPS'), 4, false, true, NOW(), NOW()),
('V-OPS-005', '재해복구 계획 부재', '재해복구 계획이 수립되지 않거나 테스트가 미수행됨', (SELECT id FROM vulnerability_categories WHERE code='VC-OPS'), 4, false, true, NOW(), NOW()),
('V-OPS-006', '접근권한 검토 미흡', '사용자 접근권한에 대한 정기적인 검토가 이루어지지 않음', (SELECT id FROM vulnerability_categories WHERE code='VC-OPS'), 3, false, true, NOW(), NOW()),
('V-OPS-007', '시간 동기화 미설정', '시스템 간 시간 동기화(NTP)가 설정되지 않음', (SELECT id FROM vulnerability_categories WHERE code='VC-OPS'), 2, false, true, NOW(), NOW());

-- 웹 애플리케이션 취약점 (OWASP Top 10 2025)
INSERT INTO vulnerabilities (code, name, description, category_id, severity, is_custom, is_active, created_at, updated_at) VALUES
('V-WEB-001', '접근 제어 위반 (Broken Access Control)', '사용자가 권한 밖의 기능이나 데이터에 접근 가능 (OWASP A01:2025)', (SELECT id FROM vulnerability_categories WHERE code='VC-WEB'), 5, false, true, NOW(), NOW()),
('V-WEB-002', '보안 설정 오류 (Security Misconfiguration)', '기본 설정 사용, 불필요한 기능 활성화, 에러 메시지 노출 (OWASP A02:2025)', (SELECT id FROM vulnerability_categories WHERE code='VC-WEB'), 4, false, true, NOW(), NOW()),
('V-WEB-003', '소프트웨어 공급망 취약점', '서드파티 라이브러리, 오픈소스 구성요소의 취약점 (OWASP A03:2025)', (SELECT id FROM vulnerability_categories WHERE code='VC-WEB'), 5, false, true, NOW(), NOW()),
('V-WEB-004', '인증 취약점 (Authentication Failures)', '인증 메커니즘의 결함으로 비인가 접근 허용 (OWASP A04:2025)', (SELECT id FROM vulnerability_categories WHERE code='VC-WEB'), 5, false, true, NOW(), NOW()),
('V-WEB-005', '인젝션 (Injection)', 'SQL, NoSQL, OS, LDAP 인젝션 등 (OWASP A05:2025)', (SELECT id FROM vulnerability_categories WHERE code='VC-WEB'), 5, false, true, NOW(), NOW()),
('V-WEB-006', '암호화 실패 (Cryptographic Failures)', '민감 데이터 보호를 위한 암호화 미적용 또는 부적절한 적용 (OWASP A06:2025)', (SELECT id FROM vulnerability_categories WHERE code='VC-WEB'), 4, false, true, NOW(), NOW()),
('V-WEB-007', 'XSS (Cross-Site Scripting)', '사용자 입력이 적절한 검증 없이 출력되어 악성 스크립트 실행 (OWASP A07:2025)', (SELECT id FROM vulnerability_categories WHERE code='VC-WEB'), 4, false, true, NOW(), NOW()),
('V-WEB-008', 'SSRF (Server-Side Request Forgery)', '서버 측에서 비인가 요청을 수행하도록 유도 (OWASP A08:2025)', (SELECT id FROM vulnerability_categories WHERE code='VC-WEB'), 4, false, true, NOW(), NOW()),
('V-WEB-009', '보안 로깅/모니터링 실패', '보안 이벤트에 대한 로깅 및 모니터링이 부족 (OWASP A09:2025)', (SELECT id FROM vulnerability_categories WHERE code='VC-WEB'), 3, false, true, NOW(), NOW()),
('V-WEB-010', '예외 처리 미흡', '비정상 입력, 오류 복구 실패, 일관되지 않은 예외 처리 (OWASP A10:2025)', (SELECT id FROM vulnerability_categories WHERE code='VC-WEB'), 3, false, true, NOW(), NOW());

-- 클라우드 취약점
INSERT INTO vulnerabilities (code, name, description, category_id, severity, is_custom, is_active, created_at, updated_at) VALUES
('V-CLD-001', 'IAM 설정 오류', '클라우드 IAM 정책의 과도한 권한 부여 또는 설정 오류', (SELECT id FROM vulnerability_categories WHERE code='VC-CLD'), 5, false, true, NOW(), NOW()),
('V-CLD-002', '스토리지 공개 설정', 'S3, Blob Storage 등 클라우드 스토리지의 공개 접근 설정', (SELECT id FROM vulnerability_categories WHERE code='VC-CLD'), 5, false, true, NOW(), NOW()),
('V-CLD-003', '보안 그룹 설정 미흡', '인바운드/아웃바운드 규칙의 과도한 허용 (0.0.0.0/0 등)', (SELECT id FROM vulnerability_categories WHERE code='VC-CLD'), 4, false, true, NOW(), NOW()),
('V-CLD-004', '컨테이너 보안 미흡', 'Docker/K8s 이미지 취약점, 런타임 보안 미적용', (SELECT id FROM vulnerability_categories WHERE code='VC-CLD'), 4, false, true, NOW(), NOW()),
('V-CLD-005', '클라우드 로깅 미활성화', 'CloudTrail, 활동 로그 등 감사 로깅이 비활성화됨', (SELECT id FROM vulnerability_categories WHERE code='VC-CLD'), 3, false, true, NOW(), NOW()),
('V-CLD-006', '암호화 키 관리 미흡', '클라우드 KMS 미사용, 키 로테이션 미적용', (SELECT id FROM vulnerability_categories WHERE code='VC-CLD'), 4, false, true, NOW(), NOW()),
('V-CLD-007', '다중 인증 미적용', '클라우드 콘솔 관리자 계정에 MFA 미적용', (SELECT id FROM vulnerability_categories WHERE code='VC-CLD'), 5, false, true, NOW(), NOW());
