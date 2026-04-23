"""
LLM 프롬프트 빌더 단위 테스트.

순수 함수이므로 DB/네트워크 없이 검증한다.
목적: 향후 프롬프트 문구를 튜닝할 때 구조적 속성(섹션, 한국어 지시문, 주의 사항)이
깨지지 않도록 회귀 가드 역할을 한다.
"""
from app.core.llm_prompts import (
    SYSTEM_PROMPT_CORRECTIVE_ACTION,
    build_system_prompt,
    build_user_prompt,
)


class TestSystemPrompt:
    def test_contains_four_required_sections(self):
        """보완조치내역서의 4개 섹션 지시가 모두 포함되어야 한다."""
        for heading in (
            "# 1. 결함 현상",
            "# 2. 결함 원인",
            "# 3. 개선 조치 내역",
            "# 4. 재발 방지 대책",
        ):
            assert heading in SYSTEM_PROMPT_CORRECTIVE_ACTION

    def test_specifies_korean_and_honorific_register(self):
        """한국어 존댓말로 쓰라는 지시가 포함되어야 한다."""
        assert "한국어" in SYSTEM_PROMPT_CORRECTIVE_ACTION
        assert "존댓말" in SYSTEM_PROMPT_CORRECTIVE_ACTION

    def test_forbids_exaggeration_words(self):
        """과장 표현 금지가 명시되어야 한다 (할루시네이션 방어)."""
        # 문자열 '100%' 는 금지어 예시로 프롬프트에 직접 등장해야 한다.
        assert "100%" in SYSTEM_PROMPT_CORRECTIVE_ACTION

    def test_requires_bullet_hierarchy(self):
        """시스템 프롬프트가 `o` 불릿 계층 형식을 요구해야 한다."""
        # 불릿 마커 `o` 와 세부 `-` 계층 언급.
        assert " o " in SYSTEM_PROMPT_CORRECTIVE_ACTION
        assert "불릿" in SYSTEM_PROMPT_CORRECTIVE_ACTION
        # 평문 단락을 명시적으로 금지.
        assert "평문 단락 금지" in SYSTEM_PROMPT_CORRECTIVE_ACTION

    def test_requires_value_preservation(self):
        """구체 값(IP/포트/정책번호 등) 원문 보존 규칙이 있어야 한다."""
        assert "값 보존" in SYSTEM_PROMPT_CORRECTIVE_ACTION
        # Before/After 대비 형식 언급.
        assert "Before/After" in SYSTEM_PROMPT_CORRECTIVE_ACTION or "→" in SYSTEM_PROMPT_CORRECTIVE_ACTION


class TestBuildSystemPrompt:
    """시스템 프롬프트는 상황별로 하나의 예시만 주입돼야 한다.

    작은 모델(qwen3.5:2b 등) 은 두 예시가 모두 보이면 NC 와 어휘가 겹치는 쪽을
    그대로 베끼는 경향이 있다. 상황에 맞는 예시 하나만 주입해 어휘 복제를 줄인다.
    """

    def test_after_present_injects_only_mode_a_example(self):
        sp = build_system_prompt(after_count=2)
        assert "MODE A, 조치 완료 기술" in sp
        assert "MODE B, 조치 예정 기술" not in sp
        # MODE A 예시 식별자(DBSafer, wit***) 가 포함돼야 한다.
        assert "DBSafer" in sp
        # MODE B 의 백업 서버 예시는 제거돼야 한다.
        assert "bkp-srv-01" not in sp

    def test_after_absent_injects_only_mode_b_example(self):
        sp = build_system_prompt(after_count=0)
        assert "MODE B, 조치 예정 기술" in sp
        assert "MODE A, 조치 완료 기술" not in sp
        assert "bkp-srv-01" in sp
        # MODE A 예시 고유 식별자(DBSafer) 는 제거돼야 한다.
        assert "DBSafer" not in sp

    def test_template_preserves_common_rules(self):
        """두 모드 공통 규칙(MODE A/MODE B 분기, 평문 단락 금지 등) 은 양쪽 다 있어야 한다."""
        for sp in (build_system_prompt(after_count=1), build_system_prompt(after_count=0)):
            assert "MODE A" in sp
            assert "MODE B" in sp
            assert "평문 단락 금지" in sp
            assert "극성 반전 금지" in sp


class TestBuildUserPrompt:
    def _minimal_kwargs(self, **overrides):
        base = dict(
            nc_title="테스트 부적합",
            nc_description="관리자 콘솔에서 중복 로그인 허용 설정이 활성화되어 있음",
            nc_requirement=None,
            nc_type=None,
            severity=None,
            control_code=None,
            control_name=None,
            before_count=0,
            after_count=0,
            support_count=0,
            reference_count=0,
            skipped_non_image_count=0,
        )
        base.update(overrides)
        return base

    def test_includes_title_and_description(self):
        prompt = build_user_prompt(**self._minimal_kwargs())
        assert "테스트 부적합" in prompt
        assert "관리자 콘솔에서 중복 로그인" in prompt

    def test_omits_meta_block_when_no_classification_provided(self):
        prompt = build_user_prompt(**self._minimal_kwargs())
        assert "[결함 분류]" not in prompt

    def test_includes_control_when_provided(self):
        prompt = build_user_prompt(
            **self._minimal_kwargs(control_code="2.5.3", control_name="사용자 인증")
        )
        assert "[결함 분류]" in prompt
        assert "2.5.3" in prompt
        assert "사용자 인증" in prompt

    def test_includes_severity_and_nc_type_when_provided(self):
        prompt = build_user_prompt(
            **self._minimal_kwargs(nc_type="minor", severity="medium")
        )
        assert "minor" in prompt
        assert "medium" in prompt

    def test_includes_requirement_when_provided(self):
        prompt = build_user_prompt(
            **self._minimal_kwargs(nc_requirement="단일 세션만 허용할 것")
        )
        assert "[요구사항]" in prompt
        assert "단일 세션만 허용할 것" in prompt

    def test_reports_before_and_after_counts_with_position_ranges(self):
        # 1장 before + 2장 after => 1번/2~3번 범위 라벨
        prompt = build_user_prompt(
            **self._minimal_kwargs(before_count=1, after_count=2)
        )
        assert "1번 이미지: 조치 전" in prompt
        assert "2~3번 이미지: 조치 후" in prompt

    def test_includes_role_hint_when_temporal_roles_present(self):
        """before/after 가 함께 있으면 역할 혼동 금지 지시가 포함되어야 한다."""
        prompt = build_user_prompt(
            **self._minimal_kwargs(before_count=1, after_count=1)
        )
        assert "#1 은 조치 전 이미지만" in prompt
        assert "#3 은 조치 후 이미지만" in prompt

    def test_omits_role_hint_when_only_reference_or_support(self):
        prompt = build_user_prompt(
            **self._minimal_kwargs(support_count=1, reference_count=1)
        )
        assert "#1 은 조치 전" not in prompt

    def test_injects_no_after_image_hint_when_after_count_zero(self):
        """조치 후 이미지가 없으면 MODE B 강제 힌트가 user 메시지 끝에 들어가야 한다."""
        prompt = build_user_prompt(**self._minimal_kwargs(before_count=1))
        assert "조치 후 이미지가 **없습니다**" in prompt
        assert "조치 예정: " in prompt
        # 금지 동사 목록이 들어 있어야 한다.
        for banned in ("확인함", "적용하였으며", "완료하였습니다"):
            assert banned in prompt

    def test_no_after_hint_absent_when_after_image_exists(self):
        """조치 후 이미지가 있으면 MODE B 힌트는 노출되지 않아야 한다 (MODE A 적용)."""
        prompt = build_user_prompt(
            **self._minimal_kwargs(before_count=1, after_count=1)
        )
        assert "조치 후 이미지가 **없습니다**" not in prompt
        # MODE B 가 아닐 땐 '조치 예정:' 템플릿 힌트도 user 꼬리에 노출되지 않아야
        # (시스템 프롬프트에는 MODE B 규칙이 상주하지만 user 메시지 tail 은 깨끗).
        assert "조치 예정: " not in prompt

    def test_system_prompt_defines_mode_a_and_mode_b(self):
        """시스템 프롬프트가 MODE A/MODE B 분기를 명시해야 한다 (회귀 방지)."""
        assert "MODE A" in SYSTEM_PROMPT_CORRECTIVE_ACTION
        assert "MODE B" in SYSTEM_PROMPT_CORRECTIVE_ACTION
        # MODE B 의 핵심 금지 동사가 시스템 프롬프트에도 존재해야 한다.
        assert "확인함" in SYSTEM_PROMPT_CORRECTIVE_ACTION
        assert "조치 예정" in SYSTEM_PROMPT_CORRECTIVE_ACTION

    def test_polarity_hint_appears_in_every_user_prompt(self):
        """#1 의 부정 표현 극성 유지 경고가 항상 user 메시지 꼬리에 포함돼야 한다."""
        prompt = build_user_prompt(
            **self._minimal_kwargs(before_count=1, after_count=1)
        )
        assert "극성으로 그대로 유지" in prompt
        # 반대 극성 '남는 상태', '적용됨' 금지 조항도 드러나야 한다.
        assert "남는 상태" in prompt
        # #1 에 통제항목 문장이 금지됨을 명시해야 한다.
        assert "통제항목 X 에 따라" in prompt

    def test_system_prompt_forbids_polarity_flip_in_section_1(self):
        """시스템 프롬프트가 극성 반전을 명시적으로 금지하고 원문 부정 표현을 보존하도록 지시해야 한다."""
        assert "극성 반전 금지" in SYSTEM_PROMPT_CORRECTIVE_ACTION
        # 구체 부정 표현 보존 지시 (원문 "X 미적용" / "Z 남지 않음" 을 유지하라는 규칙).
        assert "미적용" in SYSTEM_PROMPT_CORRECTIVE_ACTION
        assert "남지 않음" in SYSTEM_PROMPT_CORRECTIVE_ACTION

    def test_value_preservation_hint_in_user_tail(self):
        """구체 값(IP/포트/정책번호) 원문 보존 힌트가 user tail 에 들어가야 한다."""
        prompt = build_user_prompt(**self._minimal_kwargs())
        # 구체 값 유형 중 최소 하나 이상 예시가 등장.
        assert ("IP/CIDR" in prompt) or ("포트 번호" in prompt) or ("정책 번호" in prompt)
        assert "원문 그대로" in prompt
        # Before/After 대비 유도 문구.
        assert "X → Y" in prompt or "Before/After" in prompt

    def test_bullet_format_hint_in_user_tail(self):
        """출력 형식(` o ` 계층 불릿) 힌트가 user tail 에 들어가야 한다."""
        prompt = build_user_prompt(**self._minimal_kwargs())
        assert "불릿" in prompt
        # ` o ` 마커와 세부 `-` 들여쓰기 모두 언급.
        assert "o " in prompt
        assert "-" in prompt

    def test_reports_support_and_reference_sections(self):
        prompt = build_user_prompt(
            **self._minimal_kwargs(support_count=1, reference_count=2)
        )
        assert "보조 증적" in prompt
        assert "참고 (역할 미지정)" in prompt

    def test_empty_attachments_block_shows_hint(self):
        prompt = build_user_prompt(**self._minimal_kwargs())
        assert "첨부된 이미지 증적이 없습니다" in prompt

    def test_mentions_skipped_non_image_attachments(self):
        prompt = build_user_prompt(
            **self._minimal_kwargs(before_count=1, skipped_non_image_count=3)
        )
        assert "비이미지 증적 3건" in prompt

    def test_omits_skip_notice_when_no_non_image_skipped(self):
        prompt = build_user_prompt(**self._minimal_kwargs(before_count=1))
        assert "비이미지 증적" not in prompt

    def test_closes_with_explicit_task_instruction(self):
        """모델에게 '보완조치내역서 초안 작성' 지시가 있어야 한다."""
        prompt = build_user_prompt(**self._minimal_kwargs())
        assert "보완조치내역서 초안을 작성" in prompt

    def test_after_only_triggers_role_isolation_hint(self):
        """after 이미지만 있을 때 #1 에 이미지 내용을 끌어오지 말라는 가드가 붙어야 한다.

        회귀 방지 — NC #7 에서 관찰된 버그: 사용자가 '조치 후' 스크린샷만 올렸는데
        모델이 성공 로그의 IP/타임스탬프를 #1 결함 현상 세부 불릿으로 인용하며
        "남지 않음" 이라는 부정 서술과 모순되는 출력을 만들었다.
        """
        prompt = build_user_prompt(**self._minimal_kwargs(after_count=2))
        assert "모두 조치 후" in prompt
        # #1 에 이미지 값 인용 금지 문구 — 핵심 필드 유형이 명시돼야 함.
        assert "#1 결함" in prompt
        assert "타임스탬프" in prompt
        # 자기모순 경고가 드러나야 한다.
        assert "자기모순" in prompt

    def test_after_only_triggers_mode_a_hint(self):
        """after 이미지가 있으면 MODE A (조치 완료 기술) 힌트가 붙어야 한다."""
        prompt = build_user_prompt(**self._minimal_kwargs(after_count=1))
        assert "MODE A" in prompt
        # '조치 예정:' 접두사를 금지한다는 메시지가 명시돼야 한다.
        assert "조치 예정:" in prompt and "금지" in prompt
        # 완료 어미 예시가 드러나야 함.
        assert "완료함" in prompt
        # MODE B 힌트(조치 예정) 와 충돌하면 안 됨 — after_count>0 이면 no_after_hint 는 off.
        assert "조치 후 이미지가 **없습니다**" not in prompt

    def test_before_and_after_does_not_emit_after_only_hint(self):
        """before 와 after 가 함께 있을 때는 'after-only' 가드가 나오지 않아야 한다."""
        prompt = build_user_prompt(
            **self._minimal_kwargs(before_count=1, after_count=1)
        )
        assert "모두 조치 후" not in prompt
        # 하지만 MODE A 힌트는 여전히 유효해야 한다 (after 이미지가 있으므로).
        assert "MODE A" in prompt

    def test_enumeration_hint_fires_on_numbered_description(self):
        """[결함 내용] 이 '1) ..., 2) ...' 형태면 항목별 분리 힌트가 붙어야 한다.

        회귀 방지 — NC #7 에서 관찰된 버그: 2개 메뉴(PW 발급 관리 / Staff Action) 를
        모델이 Staff Action 하나로 뭉치고 동일 문장을 중복 복사했다.
        """
        prompt = build_user_prompt(
            **self._minimal_kwargs(
                nc_description=(
                    "관리자페이지\n"
                    "1) PW 발급 관리 : 상세 조회 행위는 남지 않음\n"
                    "2) Staff Action에 메뉴 진입 로그 남으나, 상세 조회 행위는 남지 않음"
                )
            )
        )
        # 항목별 분리 지시가 드러나야 한다.
        assert "여러 개의 번호/글머리 항목" in prompt
        # 주어/대상을 다르게 쓰라는 규칙 포함.
        assert "주어/대상" in prompt or "주어·대상" in prompt
        # 구체 예시(서로 다른 도메인) 가 포함돼 현재 NC 와 겹치지 않아야 한다.
        # (NC #7 의 Staff Action/PW 발급 관리 를 예시에 쓰면 모델이 그대로 복사함)
        assert "방화벽" in prompt and "EPP Agent" in prompt
        # 1:1 대응 규칙.
        assert "1:1 대응" in prompt

    def test_ai_hint_block_appears_when_provided(self):
        """NC.ai_hint 가 제공되면 [심사원 추가 지시] 블록이 프롬프트 '맨 끝' (마지막
        ※ 규칙 블록보다도 뒤) 에 주입되어야 한다.

        회귀 방지 — NC #1 에서 관찰된 도메인 용어 혼동 ('이전 비밀번호 기억' 을 현재
        비밀번호 입력 요구로 잘못 이해), NC #12 에서 관찰된 지시 약화 (중간 배치 +
        이후 6개 rule 블록에 묻혀 'A -> B' 지시를 '두 표현 중 선호' 로 오해).
        작은 모델이 가장 마지막 지시를 가장 강하게 따르는 성향을 이용하기 위해
        심사원 지시는 반드시 다른 모든 블록 뒤에 와야 한다.
        """
        prompt = build_user_prompt(
            **self._minimal_kwargs(
                ai_hint="'이전 비밀번호 기억' 은 password history (재사용 차단) 을 의미함."
            )
        )
        assert "[심사원 추가 지시]" in prompt
        assert "password history" in prompt
        # 첨부 증적 블록 및 마지막 ※ 규칙 블록보다도 뒤에 와야 한다.
        hint_idx = prompt.index("[심사원 추가 지시]")
        attach_idx = prompt.index("[첨부 증적]")
        # 마지막 ※ 블록(불릿 규칙) 이후에 오는지 확인.
        last_rule_idx = prompt.rfind("※")
        assert hint_idx > attach_idx
        assert hint_idx > last_rule_idx

    def test_ai_hint_block_absent_when_not_provided(self):
        """ai_hint 가 None 이거나 공백이면 블록이 노출되지 않아야 한다."""
        for hint in (None, "", "   \n\t  "):
            prompt = build_user_prompt(**self._minimal_kwargs(ai_hint=hint))
            assert "[심사원 추가 지시]" not in prompt

    def test_enumeration_hint_absent_on_single_issue_description(self):
        """단일 이슈 설명에는 enumeration_hint 가 불필요하게 붙지 않아야 한다."""
        prompt = build_user_prompt(
            **self._minimal_kwargs(
                nc_description="관리자 콘솔에서 중복 로그인 허용 설정이 활성화되어 있음"
            )
        )
        assert "여러 개의 번호/글머리 항목" not in prompt

    def test_system_prompt_forbids_duplicate_bullets(self):
        """시스템 프롬프트가 불릿 중복을 명시적으로 금지해야 한다 (회귀 방지)."""
        assert "중복 금지" in SYSTEM_PROMPT_CORRECTIVE_ACTION
        # 같은 문장·조치를 두 번 쓰지 말라는 지시가 명문화돼 있어야 한다.
        assert "두 번 쓰지" in SYSTEM_PROMPT_CORRECTIVE_ACTION

    def test_strips_surrounding_whitespace_in_user_fields(self):
        """제목/설명 앞뒤 공백이 출력에 튀어나오지 않는지 확인."""
        prompt = build_user_prompt(
            **self._minimal_kwargs(
                nc_title="  앞뒤공백 부적합  ",
                nc_description="\n  설명 본문\n",
            )
        )
        assert "  앞뒤공백" not in prompt
        assert "앞뒤공백 부적합" in prompt
        # 설명 앞의 공백/개행도 제거됨
        assert "\n  설명 본문" not in prompt
