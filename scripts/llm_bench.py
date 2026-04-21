"""One-off benchmark: measure qwen2.5vl:7b latency on a real before/after
Korean ISMS defect screenshot pair, with output formatted as a 보완조치내역서.

Intentionally self-contained (no deps beyond stdlib + httpx). Talks to the
ollama container via the docker bridge network. Prints wall-clock seconds and
the raw response so we can judge both speed and output quality.

Run from the repo root:
    docker run --rm --network isms-management_isms_network \
        -v "$(pwd):/work" -w /work python:3.11-slim \
        sh -c "pip install -q httpx && python scripts/llm_bench.py"
"""
from __future__ import annotations

import base64
import json
import os
import sys
import time
from pathlib import Path

import httpx

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://ollama:11434")
MODEL = os.environ.get("LLM_MODEL", "qwen2.5vl:7b")
BENCH_DIR = Path(os.environ.get("BENCH_DIR", "/tmp/llm-bench"))

SYSTEM_PROMPT = """\
당신은 ISMS-P(정보보호 및 개인정보보호 관리체계) 인증심사 보조자입니다.
심사원이 제공하는 결함(부적합) 설명과 증적 스크린샷(조치 전/후)을 보고,
국내 ISMS-P 심사 실무에서 사용되는 '보완조치내역서' 초안을 한국어 존댓말로 작성하세요.

출력은 다음 4개 섹션을 정확히 그대로 사용하고, 각 섹션은 1~4문장으로 간결하게 작성하세요.

# 1. 결함 현상
(조치 전 스크린샷에서 확인되는 구체적 현상. 어떤 시스템/화면/설정값이 어떻게 되어 있었는지 명시.)

# 2. 결함 원인
(해당 설정이 왜 부적합으로 판단되는지, 관련 통제항목 관점에서의 원인.)

# 3. 개선 조치 내역
(실제 수행한 조치. 조치 후 스크린샷에서 확인되는 변경된 설정값을 근거로 기술.)

# 4. 재발 방지 대책
(향후 동일 결함이 재발하지 않도록 수립한 운영/절차상의 방안. 책임자·주기·기록 방법 포함 시 우수.)

주의:
- 스크린샷에서 실제로 관찰 가능한 내용만 기술하고, 추측은 피하세요.
- 과장·확정 표현(100%, 완벽히, 반드시 방지됨 등)은 사용하지 마세요.
- 고유명사(시스템명, 메뉴명, 설정키)는 스크린샷에 표기된 그대로 인용하세요.
"""

USER_TEXT = """\
[결함 요약]
통제항목: 2.5.3 사용자 인증 (관리자 계정 중복 로그인 제어)
결함 유형: 부적합(Minor)
심사원 메모: SHIELDEX 관리자 콘솔에서 동일 관리자 계정의 중복 로그인이 허용되도록 설정되어 있어,
             계정 공유·세션 탈취 시 위험이 존재함. 단일 세션만 허용되도록 설정을 변경할 것.

[첨부 증적]
- 조치 전: SHIELDEX 관리자 중복 로그인 관련 설정값이 true로 되어 있는 관리자 콘솔 화면
- 조치 후: 동일 설정값을 false로 변경한 관리자 콘솔 화면 (중복 로그인 차단 적용)

위 정보를 바탕으로 보완조치내역서 초안을 작성해주세요.
"""


def b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def main() -> int:
    before = BENCH_DIR / "before.png"
    after = BENCH_DIR / "after.png"
    for p in (before, after):
        if not p.exists():
            print(f"missing: {p}", file=sys.stderr)
            return 1

    payload = {
        "model": MODEL,
        "stream": False,
        "options": {"temperature": 0.2, "num_ctx": 4096},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": USER_TEXT,
                "images": [b64(before), b64(after)],
            },
        ],
    }

    print(f"→ model: {MODEL}")
    print(f"→ endpoint: {OLLAMA_URL}")
    print(f"→ images: {before.name} ({before.stat().st_size} B), "
          f"{after.name} ({after.stat().st_size} B)")
    print("→ sending…")

    t0 = time.monotonic()
    with httpx.Client(timeout=600.0) as client:
        r = client.post(f"{OLLAMA_URL}/api/chat", json=payload)
    elapsed = time.monotonic() - t0

    print(f"← HTTP {r.status_code} in {elapsed:.1f}s")
    if r.status_code != 200:
        print(r.text[:2000])
        return 2

    data = r.json()
    content = data.get("message", {}).get("content", "")
    print("=" * 70)
    print(content)
    print("=" * 70)

    meta = {k: data.get(k) for k in (
        "total_duration", "load_duration", "prompt_eval_count",
        "prompt_eval_duration", "eval_count", "eval_duration",
    ) if data.get(k) is not None}
    if meta:
        print("metrics:", json.dumps(meta, indent=2))
    print(f"\n→ wall-clock: {elapsed:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
