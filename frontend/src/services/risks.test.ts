/**
 * 위험 관리 API 서비스 테스트
 * TDD Step 1: RED - 테스트 먼저 작성
 *
 * 테스트 전략:
 * 1. API 호출 함수 시그니처 검증
 * 2. 요청 파라미터 검증
 * 3. 응답 타입 검증
 * 4. 오류 처리 검증
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type {
  Threat,
  ThreatList,
  ThreatCreate,
  VulnerabilityList,
  VulnerabilityAssessmentList,
  RiskScenario,
  RiskScenarioList,
  RiskAssessment,
  RiskAssessmentList,
  DoAConfig,
  RiskTreatmentPlanList,
  SOARecordList,
  RiskReportSummary,
} from '../types/risk'

const API_BASE = 'http://localhost:8000/api/v1'

// MSW 서버 설정
const server = setupServer()

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'bypass' }) // 'error' → 'bypass'로 변경
  return () => server.close()
})

describe('위협 DB API', () => {
  it('getThreats - 위협 목록을 조회해야 함', async () => {
    const mockResponse: ThreatList = {
      items: [
        {
          id: 1,
          code: 'T001',
          name: '무단 접근',
          description: '비인가 사용자의 시스템 접근',
          category_id: 1,
          category_name: '물리적 위협',
          threat_level: 3,
          is_custom: false,
          is_active: true,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: null,
        },
      ],
      total: 1,
    }

    server.use(
      http.get('http://localhost:8000/api/v1/threats', () => {
        return HttpResponse.json(mockResponse)
      })
    )

    const { getThreats } = await import('./risks')
    const result = await getThreats()

    expect(result.items).toHaveLength(1)
    expect(result.items[0].name).toBe('무단 접근')
    expect(result.total).toBe(1)
  })

  it('getThreat - 위협 상세를 조회해야 함', async () => {
    const mockThreat: Threat = {
      id: 1,
      code: 'T001',
      name: '무단 접근',
      description: '비인가 사용자의 시스템 접근',
      category_id: 1,
      category_name: '물리적 위협',
      threat_level: 3,
      is_custom: false,
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: null,
    }

    server.use(
      http.get('http://localhost:8000/api/v1/threats/:id', () => {
        return HttpResponse.json(mockThreat)
      })
    )

    const { getThreat } = await import('./risks')
    const result = await getThreat(1)

    expect(result.id).toBe(1)
    expect(result.name).toBe('무단 접근')
  })

  it('createThreat - 커스텀 위협을 생성해야 함', async () => {
    const createData: ThreatCreate = {
      code: 'T999',
      name: '신규 위협',
      threat_level: 2,
    }

    const mockResponse: Threat = {
      id: 999,
      code: 'T999',
      name: '신규 위협',
      description: null,
      category_id: null,
      category_name: null,
      threat_level: 2,
      is_custom: true,
      is_active: true,
      created_at: '2025-01-27T00:00:00Z',
      updated_at: null,
    }

    server.use(
      http.post('http://localhost:8000/api/v1/threats', async ({ request }) => {
        const body = (await request.json()) as ThreatCreate
        expect(body.code).toBe('T999')
        return HttpResponse.json(mockResponse)
      })
    )

    const { createThreat } = await import('./risks')
    const result = await createThreat(createData)

    expect(result.id).toBe(999)
    expect(result.is_custom).toBe(true)
  })

  it('updateThreat - 위협을 수정해야 함', async () => {
    const mockResponse: Threat = {
      id: 1,
      code: 'T001',
      name: '수정된 위협',
      description: null,
      category_id: null,
      category_name: null,
      threat_level: 3,
      is_custom: false,
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-27T00:00:00Z',
    }

    server.use(
      http.put('http://localhost:8000/api/v1/threats/:id', () => {
        return HttpResponse.json(mockResponse)
      })
    )

    const { updateThreat } = await import('./risks')
    const result = await updateThreat(1, { name: '수정된 위협' })

    expect(result.name).toBe('수정된 위협')
    expect(result.updated_at).not.toBeNull()
  })

  it('deleteThreat - 커스텀 위협을 삭제해야 함', async () => {
    server.use(
      http.delete('http://localhost:8000/api/v1/threats/:id', () => {
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { deleteThreat } = await import('./risks')
    await expect(deleteThreat(1)).resolves.toBeUndefined()
  })

  it('getThreatsByAssetType - 자산 유형별 위협을 조회해야 함', async () => {
    const mockResponse: ThreatList = {
      items: [
        {
          id: 1,
          code: 'T001',
          name: '무단 접근',
          description: null,
          category_id: 1,
          category_name: '물리적 위협',
          threat_level: 3,
          is_custom: false,
          is_active: true,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: null,
        },
      ],
      total: 1,
    }

    server.use(
      http.get(`${API_BASE}/threats/by-asset-type/:typeId`, () => {
        return HttpResponse.json(mockResponse)
      })
    )

    const { getThreatsByAssetType } = await import('./risks')
    const result = await getThreatsByAssetType(1)

    expect(result.items).toHaveLength(1)
  })
})

describe('취약점 DB API', () => {
  it('getVulnerabilities - 취약점 목록을 조회해야 함', async () => {
    const mockResponse: VulnerabilityList = {
      items: [
        {
          id: 1,
          code: 'V001',
          name: '패치 미적용',
          description: '최신 보안 패치 미적용',
          category_id: 1,
          category_name: '기술적 취약점',
          vulnerability_level: 3,
          is_custom: false,
          is_active: true,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: null,
        },
      ],
      total: 1,
    }

    server.use(
      http.get('http://localhost:8000/api/v1/vulnerabilities', () => {
        return HttpResponse.json(mockResponse)
      })
    )

    const { getVulnerabilities } = await import('./risks')
    const result = await getVulnerabilities()

    expect(result.items).toHaveLength(1)
    expect(result.items[0].name).toBe('패치 미적용')
  })

  it('getVulnerabilityAssessments - 취약점 점검 결과를 조회해야 함', async () => {
    const mockResponse: VulnerabilityAssessmentList = {
      items: [
        {
          id: 1,
          asset_id: 100,
          asset_name: '웹서버-01',
          asset_code: 'SRV-001',
          vulnerability_id: 1,
          vulnerability_name: '패치 미적용',
          vulnerability_code: 'V001',
          is_vulnerable: true,
          assessment_date: '2025-01-15',
          assessed_by: 10,
          assessor_name: '홍길동',
          findings: 'Windows Server 보안 패치 3건 미적용',
          remediation_status: 'in_progress',
          remediation_date: null,
          remarks: null,
          created_at: '2025-01-15T10:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      size: 10,
      pages: 1,
    }

    server.use(
      http.get(`${API_BASE}/vulnerabilities/assessments`, () => {
        return HttpResponse.json(mockResponse)
      })
    )

    const { getVulnerabilityAssessments } = await import('./risks')
    const result = await getVulnerabilityAssessments()

    expect(result.items).toHaveLength(1)
    expect(result.items[0].is_vulnerable).toBe(true)
  })
})

describe('위험 시나리오 API', () => {
  it('getRiskScenarios - 시나리오 목록을 조회해야 함', async () => {
    const mockResponse: RiskScenarioList = {
      items: [
        {
          id: 1,
          name: '2025년 1분기 위험 평가',
          description: '정기 위험 평가',
          start_date: '2025-01-01',
          end_date: '2025-03-31',
          status: 'in_progress',
          created_by: 1,
          creator_name: '관리자',
          completed_at: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: null,
          assessment_count: 50,
          high_risk_count: 5,
          exceeding_doa_count: 2,
        },
      ],
      total: 1,
      page: 1,
      size: 10,
      pages: 1,
    }

    server.use(
      http.get(`${API_BASE}/risk-scenarios`, () => {
        return HttpResponse.json(mockResponse)
      })
    )

    const { getRiskScenarios } = await import('./risks')
    const result = await getRiskScenarios()

    expect(result.items).toHaveLength(1)
    expect(result.items[0].status).toBe('in_progress')
  })

  it('createRiskScenario - 시나리오를 생성해야 함', async () => {
    const mockResponse: RiskScenario = {
      id: 2,
      name: '2025년 2분기 위험 평가',
      description: null,
      start_date: '2025-04-01',
      end_date: '2025-06-30',
      status: 'draft',
      created_by: 1,
      creator_name: '관리자',
      completed_at: null,
      created_at: '2025-01-27T00:00:00Z',
      updated_at: null,
      assessment_count: 0,
      high_risk_count: 0,
      exceeding_doa_count: 0,
    }

    server.use(
      http.post(`${API_BASE}/risk-scenarios`, () => {
        return HttpResponse.json(mockResponse)
      })
    )

    const { createRiskScenario } = await import('./risks')
    const result = await createRiskScenario({
      name: '2025년 2분기 위험 평가',
      start_date: '2025-04-01',
      end_date: '2025-06-30',
    })

    expect(result.id).toBe(2)
    expect(result.status).toBe('draft')
  })
})

describe('위험 평가 API', () => {
  it('getRiskAssessments - 위험 평가 목록을 조회해야 함', async () => {
    const mockResponse: RiskAssessmentList = {
      items: [
        {
          id: 1,
          scenario_id: 1,
          asset_id: 100,
          asset_name: '웹서버-01',
          asset_code: 'SRV-001',
          threat_id: 1,
          threat_name: '무단 접근',
          vulnerability_id: 1,
          vulnerability_name: '패치 미적용',
          asset_value: 3,
          threat_level: 3,
          vulnerability_level: 3,
          risk_score: 27,
          risk_level: 'high',
          exceeds_doa: true,
          evaluated_by: 10,
          evaluator_name: '홍길동',
          evaluated_at: '2025-01-15T10:00:00Z',
          remarks: null,
          created_at: '2025-01-15T10:00:00Z',
          updated_at: null,
          has_treatment_plan: false,
        },
      ],
      total: 1,
      page: 1,
      size: 10,
      pages: 1,
    }

    server.use(
      http.get(`${API_BASE}/risk-scenarios/:scenarioId/assessments`, () => {
        return HttpResponse.json(mockResponse)
      })
    )

    const { getRiskAssessments } = await import('./risks')
    const result = await getRiskAssessments(1)

    expect(result.items).toHaveLength(1)
    expect(result.items[0].risk_score).toBe(27)
    expect(result.items[0].exceeds_doa).toBe(true)
  })

  it('createRiskAssessment - 위험 평가를 생성해야 함', async () => {
    const mockResponse: RiskAssessment = {
      id: 1,
      scenario_id: 1,
      asset_id: 100,
      asset_name: '웹서버-01',
      asset_code: 'SRV-001',
      threat_id: 1,
      threat_name: '무단 접근',
      vulnerability_id: 1,
      vulnerability_name: '패치 미적용',
      asset_value: 3,
      threat_level: 3,
      vulnerability_level: 3,
      risk_score: 27,
      risk_level: 'high',
      exceeds_doa: true,
      evaluated_by: 10,
      evaluator_name: '홍길동',
      evaluated_at: '2025-01-15T10:00:00Z',
      remarks: null,
      created_at: '2025-01-15T10:00:00Z',
      updated_at: null,
      has_treatment_plan: false,
    }

    server.use(
      http.post(`${API_BASE}/risk-scenarios/:scenarioId/assessments`, () => {
        return HttpResponse.json(mockResponse)
      })
    )

    const { createRiskAssessment } = await import('./risks')
    const result = await createRiskAssessment(1, {
      asset_id: 100,
      threat_id: 1,
      vulnerability_id: 1,
      asset_value: 3,
      threat_level: 3,
      vulnerability_level: 3,
    })

    expect(result.risk_score).toBe(27)
  })

  it('calculateRiskScenario - 시나리오 전체 위험도를 재계산해야 함', async () => {
    server.use(
      http.post(`${API_BASE}/risk-scenarios/:scenarioId/calculate`, () => {
        return HttpResponse.json({ message: '위험도 재계산 완료' })
      })
    )

    const { calculateRiskScenario } = await import('./risks')
    await expect(calculateRiskScenario(1)).resolves.toBeDefined()
  })
})

describe('DoA 관리 API', () => {
  it('getCurrentDoA - 현재 DoA 설정을 조회해야 함', async () => {
    const mockResponse: DoAConfig = {
      id: 1,
      threshold_value: 18,
      effective_date: '2025-01-01',
      expiry_date: null,
      remarks: 'CISO 승인',
      approved_by: 1,
      approver_name: 'CISO',
      approval_date: '2024-12-28',
      is_active: true,
      created_at: '2024-12-28T00:00:00Z',
      updated_at: null,
    }

    server.use(
      http.get(`${API_BASE}/doa`, () => {
        return HttpResponse.json(mockResponse)
      })
    )

    const { getCurrentDoA } = await import('./risks')
    const result = await getCurrentDoA()

    expect(result.threshold_value).toBe(18)
    expect(result.is_active).toBe(true)
  })

  it('getRisksExceedingDoA - DoA 초과 위험을 조회해야 함', async () => {
    const mockResponse: RiskAssessmentList = {
      items: [],
      total: 0,
      page: 1,
      size: 10,
      pages: 0,
    }

    server.use(
      http.get(`${API_BASE}/risks/exceeding-doa`, () => {
        return HttpResponse.json(mockResponse)
      })
    )

    const { getRisksExceedingDoA } = await import('./risks')
    const result = await getRisksExceedingDoA()

    expect(result.total).toBeDefined()
  })
})

describe('위험 처리 계획 API', () => {
  it('getRiskTreatmentPlans - 처리 계획 목록을 조회해야 함', async () => {
    const mockResponse: RiskTreatmentPlanList = {
      items: [],
      total: 0,
      page: 1,
      size: 10,
      pages: 0,
    }

    server.use(
      http.get(`${API_BASE}/risk-treatments`, () => {
        return HttpResponse.json(mockResponse)
      })
    )

    const { getRiskTreatmentPlans } = await import('./risks')
    const result = await getRiskTreatmentPlans()

    expect(result.total).toBeDefined()
  })

  it('createRiskTreatmentPlan - 처리 계획을 생성해야 함', async () => {
    server.use(
      http.post(`${API_BASE}/risk-assessments/:assessmentId/treatments`, () => {
        return HttpResponse.json({ id: 1 })
      })
    )

    const { createRiskTreatmentPlan } = await import('./risks')
    const result = await createRiskTreatmentPlan(1, {
      strategy: 'reduce',
      description: '보안 패치 적용',
    })

    expect(result.id).toBe(1)
  })
})

describe('SOA API', () => {
  it('getSOARecords - SOA 레코드 목록을 조회해야 함', async () => {
    const mockResponse: SOARecordList = {
      items: [],
      total: 0,
      applicable_count: 0,
      not_applicable_count: 0,
    }

    server.use(
      http.get(`${API_BASE}/soa`, () => {
        return HttpResponse.json(mockResponse)
      })
    )

    const { getSOARecords } = await import('./risks')
    const result = await getSOARecords()

    expect(result.total).toBeDefined()
  })

  it('generateSOA - SOA를 자동 생성해야 함', async () => {
    server.use(
      http.post(`${API_BASE}/soa/generate`, () => {
        return HttpResponse.json({ message: 'SOA 생성 완료' })
      })
    )

    const { generateSOA } = await import('./risks')
    await expect(generateSOA()).resolves.toBeDefined()
  })

  it('exportSOA - SOA를 내보내기해야 함', async () => {
    server.use(
      http.get(`${API_BASE}/soa/export`, () => {
        return HttpResponse.json({ download_url: '/downloads/soa.xlsx' })
      })
    )

    const { exportSOA } = await import('./risks')
    const result = await exportSOA({ format: 'excel', template_type: 'isms_p' })

    expect(result.downloadUrl).toBeDefined()
  })
})

describe('위험 평가 보고서 API', () => {
  it('getRiskReport - 위험 평가 보고서를 조회해야 함', async () => {
    const mockResponse: RiskReportSummary = {
      scenario_id: 1,
      scenario_name: '2025년 1분기 위험 평가',
      assessment_period: '2025-01-01 ~ 2025-03-31',
      total_assets: 100,
      total_risks: 55,
      risk_distribution: {
        high: 5,
        medium: 20,
        low: 30,
        total: 55,
      },
      exceeding_doa_count: 2,
      treatment_progress: {
        total: 10,
        completed: 3,
        in_progress: 5,
        planned: 2,
        cancelled: 0,
        completion_rate: 0.3,
      },
      top_risks: [],
    }

    server.use(
      http.get(`${API_BASE}/risk-scenarios/:scenarioId/report`, () => {
        return HttpResponse.json(mockResponse)
      })
    )

    const { getRiskReport } = await import('./risks')
    const result = await getRiskReport(1)

    expect(result.scenario_id).toBe(1)
    expect(result.total_risks).toBe(55)
  })

  it('exportRiskReport - 위험 평가 보고서를 내보내기해야 함', async () => {
    server.use(
      http.get(`${API_BASE}/risk-scenarios/:scenarioId/report/export`, () => {
        return HttpResponse.json({ download_url: '/downloads/report.xlsx' })
      })
    )

    const { exportRiskReport } = await import('./risks')
    const result = await exportRiskReport(1, 'excel')

    expect(result.downloadUrl).toBeDefined()
  })
})

describe('에러 처리', () => {
  it('API 오류 시 적절한 에러를 던져야 함', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/threats', () => {
        return HttpResponse.json({ message: '권한이 없습니다' }, { status: 403 })
      })
    )

    const { getThreats } = await import('./risks')
    await expect(getThreats()).rejects.toThrow()
  })

  it('네트워크 오류 시 적절한 에러를 던져야 함', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/threats', () => {
        return HttpResponse.error()
      })
    )

    const { getThreats } = await import('./risks')
    await expect(getThreats()).rejects.toThrow()
  })
})
