"""
ISMS-P 인증기준 안내서 PDF에서 통제항목 상세 정보를 추출하여 DB에 업데이트하는 스크립트

추출 대상: 주요 확인사항, 관련 법규, 증거자료 예시
"""
import sys
import io
import re
import json

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import fitz  # PyMuPDF

PDF_PATH = "/tmp/isms_guide.pdf"

def extract_controls():
    doc = fitz.open(PDF_PATH)

    # Collect all text with page markers
    full_text = ""
    for page_num in range(doc.page_count):
        page = doc[page_num]
        full_text += page.get_text()

    # Valid control codes
    valid_codes = set()
    for d1 in range(1, 4):
        for d2 in range(1, 13):
            for d3 in range(1, 10):
                valid_codes.add(f"{d1}.{d2}.{d3}")

    # Pattern to find control item sections
    # Each item starts with code + title, then 인증기준, 주요 확인사항, etc.
    control_pattern = re.compile(
        r'(\d+\.\d+\.\d+)\s+(.+?)\n'
        r'인증기준\n(.+?)'
        r'주요 확인사항\n(.+?)'
        r'(?:관련 법규\n(.+?))?'
        r'(?:세부 설명|증거자료)',
        re.DOTALL
    )

    results = {}

    # Try a simpler approach: split by control item codes
    # Find positions of all control item headers
    item_positions = []
    for match in re.finditer(r'\n(\d+\.\d+\.\d+)\s{1,5}(\S.+)\n인증기준\n', full_text):
        code = match.group(1)
        if code in valid_codes:
            item_positions.append((match.start(), code, match.group(2).strip()))

    print(f"Found {len(item_positions)} control items")

    for i, (pos, code, title) in enumerate(item_positions):
        # Get text from this item to the next item
        if i + 1 < len(item_positions):
            end_pos = item_positions[i + 1][0]
        else:
            end_pos = len(full_text)

        section_text = full_text[pos:end_pos]

        # Extract 주요 확인사항
        key_checks = ""
        kc_match = re.search(r'주요 확인사항\n(.+?)(?:관련 법규|세부 설명|증거자료)', section_text, re.DOTALL)
        if kc_match:
            key_checks = kc_match.group(1).strip()

        # Extract 관련 법규
        related_laws = ""
        rl_match = re.search(r'관련 법규\n(.+?)(?:세부 설명|증거자료)', section_text, re.DOTALL)
        if rl_match:
            related_laws = rl_match.group(1).strip()

        # Extract 증거자료 예시
        evidence_examples = ""
        ee_match = re.search(r'증거자료\n예시\n(.+?)(?:\d+\.\d+\.\d+|\d+\.\d+\.\s|\Z)', section_text, re.DOTALL)
        if not ee_match:
            ee_match = re.search(r'증거자료\s*예시\n(.+?)(?:\n\d+\n|\Z)', section_text, re.DOTALL)
        if ee_match:
            evidence_examples = ee_match.group(1).strip()

        results[code] = {
            "title": title,
            "key_checks": key_checks,
            "related_laws": related_laws,
            "evidence_examples": evidence_examples,
        }

        # Debug output
        print(f"\n{'='*60}")
        print(f"[{code}] {title}")
        print(f"  주요 확인사항: {key_checks[:100]}..." if len(key_checks) > 100 else f"  주요 확인사항: {key_checks}")
        print(f"  관련 법규: {related_laws[:100]}..." if len(related_laws) > 100 else f"  관련 법규: {related_laws}")
        print(f"  증거자료 예시: {evidence_examples[:100]}..." if len(evidence_examples) > 100 else f"  증거자료 예시: {evidence_examples}")

    # Save to JSON
    with open("/tmp/controls_extracted.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n\nTotal extracted: {len(results)}")
    print("Saved to /tmp/controls_extracted.json")

    return results


if __name__ == "__main__":
    extract_controls()
