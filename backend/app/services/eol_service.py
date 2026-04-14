"""
endoflife.date API 연동 서비스

https://endoflife.date/docs/api 기반
- 제품 목록 조회
- 제품별 버전/EoL 정보 조회
"""
import httpx
from typing import Any, Dict, List, Optional

EOL_API_BASE = "https://endoflife.date/api"
REQUEST_TIMEOUT = 10.0


class EolService:
    """endoflife.date API 클라이언트"""

    def __init__(self) -> None:
        self._client = httpx.Client(
            base_url=EOL_API_BASE,
            timeout=REQUEST_TIMEOUT,
            headers={"Accept": "application/json"},
        )

    def get_all_products(self) -> List[str]:
        """전체 제품 목록 반환 (약 650개)"""
        resp = self._client.get("/all.json")
        resp.raise_for_status()
        return resp.json()

    def search_products(self, query: str) -> List[str]:
        """제품명 검색 (부분 일치)"""
        all_products = self.get_all_products()
        q = query.lower()
        return [p for p in all_products if q in p.lower()]

    def get_product_cycles(self, product: str) -> List[Dict[str, Any]]:
        """
        제품의 전체 릴리스 사이클 조회

        반환 예시:
        [
            {
                "cycle": "2022",
                "releaseDate": "2021-08-18",
                "eol": "2031-10-14",
                "latest": "10.0.20348",
                "lts": true,
                "support": "2026-10-13",
                ...
            },
            ...
        ]
        """
        resp = self._client.get(f"/{product}.json")
        resp.raise_for_status()
        return resp.json()

    def get_cycle_detail(self, product: str, cycle: str) -> Dict[str, Any]:
        """특정 제품의 특정 사이클 상세 조회"""
        resp = self._client.get(f"/{product}/{cycle}.json")
        resp.raise_for_status()
        return resp.json()

    def find_eol_date(
        self, product: str, version: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        제품과 (선택적) 버전으로 EoL 날짜를 찾는다.

        version이 주어지면 해당 사이클을 찾고,
        없으면 최신 LTS 사이클을 반환한다.

        Returns:
            {
                "product": "windows-server",
                "cycle": "2019",
                "eol": "2029-01-09",
                "releaseDate": "2018-11-13",
                "latest": "10.0.17763",
                "lts": true,
                "support": "2024-01-09",
            }
            또는 None
        """
        cycles = self.get_product_cycles(product)
        if not cycles:
            return None

        if version:
            v = version.lower().strip()
            # 1) cycle 이름과 정확히 일치하는지 확인
            for c in cycles:
                if str(c.get("cycle", "")).lower() == v:
                    return {"product": product, **c}
            # 2) releaseLabel 부분 일치
            for c in cycles:
                label = str(c.get("releaseLabel", "")).lower()
                if v in label:
                    return {"product": product, **c}
            # 3) latest 버전 접두사 일치
            for c in cycles:
                latest = str(c.get("latest", "")).lower()
                if latest.startswith(v) or v.startswith(latest):
                    return {"product": product, **c}
            # 4) cycle 이름이 버전에 포함
            for c in cycles:
                cycle_name = str(c.get("cycle", "")).lower()
                if cycle_name in v or v in cycle_name:
                    return {"product": product, **c}

        # 버전 없으면 첫 번째 (최신) 사이클 반환
        return {"product": product, **cycles[0]}

    def close(self) -> None:
        self._client.close()
