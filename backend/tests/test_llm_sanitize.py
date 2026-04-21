"""
LLM 초안 후처리(_sanitize_draft) 단위 테스트.

모델이 프롬프트 규칙을 어기고 뱉어낸 장식 요소를 UI 노출 전에 제거하는지 확인.
"""
from __future__ import annotations

from app.services.llm_scheduler import _sanitize_draft


class TestSanitizeDraft:
    def test_strips_markdown_image_refs(self):
        text = (
            "# 1. 결함 현상\n본문1\n\n"
            "![조치 전 상태](image.png)\n\n"
            "# 3. 개선 조치 내역\n본문3\n"
            "![after](x.jpg)"
        )
        out = _sanitize_draft(text)
        assert "![" not in out
        assert "image.png" not in out
        assert "x.jpg" not in out
        # 본문 텍스트는 그대로
        assert "본문1" in out
        assert "본문3" in out

    def test_strips_leading_title_before_section_1(self):
        """모델이 맨 위에 '# XXX 내역서' 같은 제목을 붙이는 문제 제거."""
        text = (
            "# 비밀번호 재사용 방지 규칙 개선 조치 내역서\n\n"
            "# 1. 결함 현상\n본문1\n"
        )
        out = _sanitize_draft(text)
        assert out.startswith("# 1. 결함 현상")

    def test_keeps_section_1_when_it_is_first(self):
        text = "# 1. 결함 현상\n본문1\n"
        out = _sanitize_draft(text)
        assert out.startswith("# 1. 결함 현상")
        assert "본문1" in out

    def test_normalizes_double_hash_section_headers(self):
        text = "## 1. 결함 현상\n본문1\n## 2. 결함 원인\n본문2\n"
        out = _sanitize_draft(text)
        assert "# 1. 결함 현상" in out
        assert "## 1." not in out
        assert "# 2. 결함 원인" in out

    def test_strips_code_fences(self):
        text = "# 1. 결함 현상\n```\n본문\n```\n"
        out = _sanitize_draft(text)
        assert "```" not in out
        assert "본문" in out

    def test_keeps_inline_link_text_while_dropping_url(self):
        # 마크다운 [텍스트](url) → 텍스트만 유지.
        text = "# 1. 결함 현상\n관리자 [콘솔](http://example.com)에서 확인됨.\n"
        out = _sanitize_draft(text)
        assert "http://example.com" not in out
        assert "관리자 콘솔에서 확인됨." in out

    def test_collapses_excessive_blank_lines(self):
        text = "# 1. 결함 현상\n본문1\n\n\n\n# 2. 결함 원인\n본문2\n"
        out = _sanitize_draft(text)
        assert "\n\n\n" not in out

    def test_empty_input_is_passthrough(self):
        assert _sanitize_draft("") == ""

    def test_none_like_input_is_passthrough(self):
        # 빈 문자열과 동일 처리 — 방어적.
        assert _sanitize_draft("") == ""
