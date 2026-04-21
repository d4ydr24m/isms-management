"""End-to-end smoke test for the LLM corrective-action endpoint.

Designed to run inside the isms_backend container:
    docker cp scripts/llm_smoke_test.py isms_backend:/tmp/
    docker cp /tmp/llm-bench/before.png isms_backend:/tmp/
    docker cp /tmp/llm-bench/after.png  isms_backend:/tmp/
    docker exec isms_backend python /tmp/llm_smoke_test.py

Checks:
1. login → get bearer token
2. upload 2 screenshots → evidence IDs
3. POST /api/v1/llm/corrective-actions/generate
4. GET /{task_id} until status == succeeded|failed (cap ~10 min)
5. assert result_text is non-empty and contains one of our section headers
"""
import json
import sys
import time
import urllib.request as ur
import urllib.error
from pathlib import Path

API = "http://localhost:8000/api/v1"
EMAIL = "admin@example.com"
PASSWORD = "Admin123!@#"

BEFORE = Path("/tmp/before.png")
AFTER = Path("/tmp/after.png")


def _req(method, path, *, token=None, headers=None, data=None, content_type=None, timeout=60):
    h = {"Accept": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if content_type:
        h["Content-Type"] = content_type
    if headers:
        h.update(headers)
    if data is not None and not isinstance(data, (bytes, bytearray)):
        data = json.dumps(data).encode()
        h.setdefault("Content-Type", "application/json")
    req = ur.Request(f"{API}{path}", method=method, headers=h, data=data)
    try:
        with ur.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            ct = resp.headers.get("Content-Type", "")
            if "json" in ct:
                return resp.status, json.loads(body) if body else None
            return resp.status, body
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"HTTP {e.code} on {method} {path}: {body[:500]}", file=sys.stderr)
        raise


def login():
    status, body = _req(
        "POST", "/auth/login", data={"email": EMAIL, "password": PASSWORD}
    )
    return body["data"]["accessToken"]


def _multipart(fields, files):
    """Build a multipart/form-data body without external deps."""
    boundary = "----smokeboundary" + str(int(time.time()))
    lines = []
    for name, value in fields.items():
        lines.append(f"--{boundary}".encode())
        lines.append(f'Content-Disposition: form-data; name="{name}"'.encode())
        lines.append(b"")
        lines.append(str(value).encode())
    for name, (filename, content, mime) in files.items():
        lines.append(f"--{boundary}".encode())
        lines.append(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"'.encode()
        )
        lines.append(f"Content-Type: {mime}".encode())
        lines.append(b"")
        lines.append(content)
    lines.append(f"--{boundary}--".encode())
    lines.append(b"")
    body = b"\r\n".join(lines)
    return body, f"multipart/form-data; boundary={boundary}"


def upload_evidence(token, title, path: Path):
    body, ct = _multipart(
        fields={"title": title},
        files={"file": (path.name, path.read_bytes(), "image/png")},
    )
    status, data = _req("POST", "/evidences", token=token, data=body, content_type=ct)
    return data["id"]


def latest_nc(token):
    status, data = _req("GET", "/nonconformities?size=1", token=token)
    items = data.get("items") if isinstance(data, dict) else data
    if not items:
        raise SystemExit("No NonConformity in DB — seed one first.")
    return items[0]["id"]


def main():
    if not BEFORE.exists() or not AFTER.exists():
        raise SystemExit(f"Missing test images at {BEFORE} / {AFTER}")

    print("→ login")
    token = login()

    print("→ upload screenshots")
    before_id = upload_evidence(token, "SMOKE: before", BEFORE)
    after_id = upload_evidence(token, "SMOKE: after", AFTER)
    print(f"  before_id={before_id} after_id={after_id}")

    nc_id = latest_nc(token)
    print(f"→ using non_conformity_id={nc_id}")

    print("→ POST generate")
    status, data = _req(
        "POST",
        "/llm/corrective-actions/generate",
        token=token,
        data={
            "non_conformity_id": nc_id,
            "evidence_ids": [before_id, after_id],
        },
    )
    print(f"  HTTP {status} response: {data}")
    task_id = data["task_id"]
    suggestion_id = data["suggestion_id"]

    print("→ polling…")
    deadline = time.monotonic() + 900  # 15 min
    last_status = None
    while time.monotonic() < deadline:
        status, data = _req("GET", f"/llm/corrective-actions/{task_id}", token=token)
        s = data["status"]
        if s != last_status:
            print(f"  status={s}")
            last_status = s
        if s in ("succeeded", "failed"):
            break
        time.sleep(5)
    else:
        raise SystemExit("Timed out waiting for suggestion.")

    print("=" * 70)
    if data["status"] == "succeeded":
        print(data["result_text"])
        print("=" * 70)
        text = data["result_text"]
        assert text, "empty result"
        # 모델이 '# 1.' 또는 '1.' 두 스타일 중 하나로 섹션을 매긴다 — 둘 다 허용.
        assert any(
            marker in text for marker in ("# 1.", "1.")
        ), "missing section header"
        assert "결함" in text, "result does not look like 보완조치내역서"
        print("SMOKE TEST PASSED")
    else:
        print(f"FAILED: {data.get('error_message')}")
        sys.exit(2)


if __name__ == "__main__":
    main()
