"""
EoL (End of Life) 조회 API

endoflife.date 외부 API를 통한 제품 EoL 정보 조회 및 자산 연동
"""
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user
from app.models.asset import Asset
from app.models.user import User
from app.services.eol_service import EolService

router = APIRouter()

_eol_service: Optional[EolService] = None


def get_eol_service() -> EolService:
    global _eol_service
    if _eol_service is None:
        _eol_service = EolService()
    return _eol_service


# ── Schemas ──────────────────────────────────────────────────────────────

class ProductSearchResponse(BaseModel):
    products: List[str]
    total: int


class CycleInfo(BaseModel):
    cycle: str
    release_label: Optional[str] = None
    release_date: Optional[str] = None
    eol: Any = None  # str (date) or bool
    latest: Optional[str] = None
    lts: Any = None  # bool or str (date)
    support: Any = None  # str (date) or bool
    extended_support: Any = None  # str (date) or bool (LTS/extended)


class ProductCyclesResponse(BaseModel):
    product: str
    cycles: List[CycleInfo]


class EolLookupRequest(BaseModel):
    product: str = Field(..., description="endoflife.date 제품 ID")
    version: Optional[str] = Field(None, description="버전 (선택)")


class EolLookupResponse(BaseModel):
    product: str
    cycle: Optional[str] = None
    eol: Any = None
    release_date: Optional[str] = None
    latest: Optional[str] = None
    lts: Any = None
    support: Any = None


class ApplyEolRequest(BaseModel):
    asset_id: int = Field(..., description="자산 ID")
    eol_date: str = Field(..., description="EoL 날짜 (YYYY-MM-DD)")


# ── Endpoints ────────────────────────────────────────────────────────────


@router.get("/products", response_model=ProductSearchResponse)
def search_products(
    q: str = Query("", description="검색어"),
    current_user: User = Depends(get_current_active_user),
):
    """제품 검색 (endoflife.date)"""
    svc = get_eol_service()
    try:
        if q:
            products = svc.search_products(q)
        else:
            products = svc.get_all_products()
        return ProductSearchResponse(products=products[:50], total=len(products))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"endoflife.date API 호출 실패: {str(e)}",
        )


@router.get("/products/{product}/cycles", response_model=ProductCyclesResponse)
def get_product_cycles(
    product: str,
    current_user: User = Depends(get_current_active_user),
):
    """제품별 버전/사이클 목록 조회"""
    svc = get_eol_service()
    try:
        raw_cycles = svc.get_product_cycles(product)
        cycles = []
        for c in raw_cycles:
            cycles.append(CycleInfo(
                cycle=str(c.get("cycle", "")),
                release_label=c.get("releaseLabel"),
                release_date=c.get("releaseDate"),
                eol=c.get("eol"),
                latest=c.get("latest"),
                lts=c.get("lts"),
                support=c.get("support"),
                extended_support=c.get("extendedSupport"),
            ))
        return ProductCyclesResponse(product=product, cycles=cycles)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"endoflife.date API 호출 실패: {str(e)}",
        )


@router.post("/lookup", response_model=EolLookupResponse)
def lookup_eol(
    req: EolLookupRequest,
    current_user: User = Depends(get_current_active_user),
):
    """제품 + 버전으로 EoL 날짜 조회"""
    svc = get_eol_service()
    try:
        result = svc.find_eol_date(req.product, req.version)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="해당 제품/버전의 EoL 정보를 찾을 수 없습니다.",
            )
        return EolLookupResponse(
            product=result.get("product", req.product),
            cycle=str(result.get("cycle", "")),
            eol=result.get("eol"),
            release_date=result.get("releaseDate"),
            latest=result.get("latest"),
            lts=result.get("lts"),
            support=result.get("support"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"endoflife.date API 호출 실패: {str(e)}",
        )


@router.post("/apply", status_code=status.HTTP_200_OK)
def apply_eol_to_asset(
    req: ApplyEolRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """조회한 EoL 날짜를 자산에 적용"""
    asset = db.query(Asset).filter(Asset.id == req.asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="자산을 찾을 수 없습니다.",
        )

    try:
        eol_date = date.fromisoformat(req.eol_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 날짜 형식입니다. YYYY-MM-DD 형식이어야 합니다.",
        )

    asset.eol_date = eol_date
    db.commit()

    return {"message": "EoL 날짜가 적용되었습니다.", "assetId": asset.id, "eolDate": req.eol_date}
