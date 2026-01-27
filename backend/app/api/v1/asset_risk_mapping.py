"""
자산-위협-취약점 3-way 매핑 API
Phase 2: Section 5.1

엔드포인트:
- GET /recommended-threats/{asset_type_id}: 자산 유형별 위협 추천
- GET /recommended-vulnerabilities/{asset_type_id}: 자산 유형별 취약점 추천
- POST /validate: 매핑 유효성 검증
- POST /validate-batch: 일괄 매핑 검증
- POST /bulk-import: 엑셀 대량 임포트
- GET /template: 임포트 템플릿 다운로드
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from io import BytesIO

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.services.asset_risk_mapping_service import AssetRiskMappingService


router = APIRouter(prefix="/asset-risk-mapping", tags=["Asset Risk Mapping"])


# =============================================================================
# Pydantic 스키마
# =============================================================================

class ThreatRecommendation(BaseModel):
    """위협 추천 응답"""
    id: int
    code: str
    name: str
    description: Optional[str] = None
    threat_level: int
    relevance_score: Optional[float] = None

    class Config:
        from_attributes = True


class VulnerabilityRecommendation(BaseModel):
    """취약점 추천 응답"""
    id: int
    code: str
    name: str
    description: Optional[str] = None
    vulnerability_level: int

    class Config:
        from_attributes = True


class ThreatListResponse(BaseModel):
    """위협 목록 응답"""
    threats: List[ThreatRecommendation]
    total: int


class VulnerabilityListResponse(BaseModel):
    """취약점 목록 응답"""
    vulnerabilities: List[VulnerabilityRecommendation]
    total: int


class MappingValidationRequest(BaseModel):
    """매핑 유효성 검증 요청"""
    asset_id: int = Field(..., description="자산 ID")
    threat_id: int = Field(..., description="위협 ID")
    vulnerability_id: int = Field(..., description="취약점 ID")


class MappingValidationResponse(BaseModel):
    """매핑 유효성 검증 응답"""
    is_valid: bool
    errors: List[str] = []
    warnings: List[str] = []


class BatchMappingValidationRequest(BaseModel):
    """일괄 매핑 검증 요청"""
    mappings: List[MappingValidationRequest]


class BatchMappingValidationResponse(BaseModel):
    """일괄 매핑 검증 응답"""
    total: int
    valid_count: int
    invalid_count: int
    results: List[Dict[str, Any]]


class BulkImportResponse(BaseModel):
    """대량 임포트 응답"""
    total: int
    success: int
    failed: int
    skipped: int
    errors: List[Dict[str, Any]]


# =============================================================================
# API 엔드포인트
# =============================================================================

@router.get(
    "/recommended-threats/{asset_type_id}",
    response_model=ThreatListResponse,
    summary="자산 유형별 위협 추천",
    description="자산 유형에 따라 관련된 위협 목록을 추천합니다.",
)
async def get_recommended_threats(
    asset_type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ThreatListResponse:
    """
    자산 유형에 대해 관련 위협 목록을 반환합니다.

    - 자산 유형-위협 매핑 테이블을 기반으로 추천
    - 관련성 점수가 높은 순서로 정렬
    """
    service = AssetRiskMappingService(db)
    threats = service.get_recommended_threats(asset_type_id)

    # 매핑 정보로 관련성 점수 조회
    mapping_info = service.get_asset_type_threat_mappings(asset_type_id)
    relevance_map = {m["threat_id"]: m["relevance_score"] for m in mapping_info}

    threat_list = [
        ThreatRecommendation(
            id=t.id,
            code=t.code,
            name=t.name,
            description=t.description,
            threat_level=t.threat_level,
            relevance_score=relevance_map.get(t.id),
        )
        for t in threats
    ]

    return ThreatListResponse(threats=threat_list, total=len(threat_list))


@router.get(
    "/recommended-vulnerabilities/{asset_type_id}",
    response_model=VulnerabilityListResponse,
    summary="자산 유형별 취약점 추천",
    description="자산 유형에 따라 관련된 취약점 목록을 추천합니다.",
)
async def get_recommended_vulnerabilities(
    asset_type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VulnerabilityListResponse:
    """
    자산 유형에 대해 관련 취약점 목록을 반환합니다.

    - 현재는 모든 활성 취약점을 반환
    - 향후 자산 유형별 필터링 추가 예정
    """
    service = AssetRiskMappingService(db)
    vulnerabilities = service.get_recommended_vulnerabilities(asset_type_id)

    vuln_list = [
        VulnerabilityRecommendation(
            id=v.id,
            code=v.code,
            name=v.name,
            description=v.description,
            vulnerability_level=v.vulnerability_level,
        )
        for v in vulnerabilities
    ]

    return VulnerabilityListResponse(
        vulnerabilities=vuln_list, total=len(vuln_list)
    )


@router.post(
    "/validate",
    response_model=MappingValidationResponse,
    summary="매핑 유효성 검증",
    description="자산-위협-취약점 매핑의 유효성을 검증합니다.",
)
async def validate_mapping(
    request: MappingValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MappingValidationResponse:
    """
    단일 매핑의 유효성을 검증합니다.

    검증 항목:
    - 각 엔티티 존재 여부
    - 활성 상태 확인
    - 자산 유형과 위협의 관련성 (경고)
    """
    service = AssetRiskMappingService(db)
    result = service.validate_mapping(
        asset_id=request.asset_id,
        threat_id=request.threat_id,
        vulnerability_id=request.vulnerability_id,
    )

    return MappingValidationResponse(**result)


@router.post(
    "/validate-batch",
    response_model=BatchMappingValidationResponse,
    summary="일괄 매핑 유효성 검증",
    description="여러 매핑의 유효성을 한 번에 검증합니다.",
)
async def validate_mapping_batch(
    request: BatchMappingValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BatchMappingValidationResponse:
    """
    여러 매핑을 일괄 검증합니다.

    각 매핑에 대해 개별 검증을 수행하고 결과를 집계합니다.
    """
    service = AssetRiskMappingService(db)
    mappings = [
        {
            "asset_id": m.asset_id,
            "threat_id": m.threat_id,
            "vulnerability_id": m.vulnerability_id,
        }
        for m in request.mappings
    ]
    result = service.validate_mapping_batch(mappings)

    return BatchMappingValidationResponse(**result)


@router.post(
    "/bulk-import",
    response_model=BulkImportResponse,
    summary="엑셀 대량 임포트",
    description="엑셀 파일로 위험 평가 매핑을 대량 생성합니다.",
)
async def bulk_import_mappings(
    scenario_id: int = Query(..., description="위험 평가 시나리오 ID"),
    file: UploadFile = File(..., description="엑셀 파일 (.xlsx)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BulkImportResponse:
    """
    엑셀 파일에서 매핑 정보를 읽어 위험 평가를 대량 생성합니다.

    필수 컬럼:
    - 자산코드 (Asset.asset_code)
    - 위협코드 (Threat.code)
    - 취약점코드 (Vulnerability.code)

    선택 컬럼:
    - 자산가치 (1-3)
    - 위협등급 (1-3)
    - 취약점등급 (1-3)
    - 비고
    """
    # 파일 형식 검증
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(
            status_code=400,
            detail="지원되지 않는 파일 형식입니다. xlsx 파일만 지원됩니다.",
        )

    # 파일 크기 제한 (10MB)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="파일 크기가 너무 큽니다. 최대 10MB까지 지원됩니다.",
        )

    service = AssetRiskMappingService(db)
    result = service.bulk_create_mappings_from_excel(
        file_content=content,
        scenario_id=scenario_id,
        user_id=current_user.id,
    )

    return BulkImportResponse(**result)


@router.get(
    "/template",
    summary="임포트 템플릿 다운로드",
    description="대량 매핑용 엑셀 템플릿을 다운로드합니다.",
)
async def get_import_template(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """
    대량 임포트용 엑셀 템플릿을 반환합니다.

    템플릿에는 필수/선택 컬럼과 예시 데이터가 포함되어 있습니다.
    """
    service = AssetRiskMappingService(db)
    template_bytes = service.get_mapping_template()

    return StreamingResponse(
        BytesIO(template_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=risk_mapping_template.xlsx"
        },
    )
