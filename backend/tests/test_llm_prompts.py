"""
LLM 프롬프트 빌더 단위 테스트.

순수 함수이므로 DB/네트워크 없이 검증한다.
목적: 향후 프롬프트 문구를 튜닝할 때 구조적 속성(섹션, 한국어 지시문, 주의 사항)이
깨지지 않도록 회귀 가드 역할을 한다.
"""
from app.core.llm_prompts import (
    SYSTEM_PROMPT_CORRECTIVE_ACTION,
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
        """시스템 프롬프트가 극성 반전을 구체적인 옳고/틀린 예시로 금지해야 한다."""
        assert "극성 반전 금지" in SYSTEM_PROMPT_CORRECTIVE_ACTION
        # 구체적 예시가 있어야 한다 (NC #7 류 상황).
        assert "남지 않음" in SYSTEM_PROMPT_CORRECTIVE_ACTION
        assert "남는 상태가 확인됨" in SYSTEM_PROMPT_CORRECTIVE_ACTION

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
