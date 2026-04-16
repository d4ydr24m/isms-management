/**
 * 위험 관리 타입 정의 테스트
 * TDD Step 1: RED - 테스트 먼저 작성
 *
 * 테스트 전략:
 * 1. 타입 구조 검증 (컴파일 타임)
 * 2. 타입 가드 함수 테스트 (런타임)
 * 3. 상수 값 검증
 */

import { describe, it, expect } from 'vitest'
import type {
  // 위협 관련
  Threat,
  ThreatCreate,

  // 취약점 관련
  Vulnerability,
  VulnerabilityAssessment,

  // 위험 시나리오 관련
  RiskScenario,

  // 위험 평가 관련
  RiskAssessment,

  // DoA 관련
  DoAConfig,

  // 위험 처리 계획 관련
  RiskTreatmentPlan,
  RiskTreatmentProgress,

  // SOA 관련
  SOARecord,
  SOAExportRequest,

  // 보고서 관련
  RiskDistribution,
  RiskReportSummary,

} from './risk'

import {
  // 상수
  THREAT_LEVELS,
  RISK_SCENARIO_STATUSES,
  TREATMENT_STRATEGIES,

  // 헬퍼 함수
  getThreatLevelLabel,
  getTreatmentStrategyLabel,
  calculateRiskScore,
  classifyRiskLevel,
  isHighRisk,
  formatRiskScore,
} from './risk'

describe('위협 관련 타입', () => {
  it('Threat 타입이 올바른 구조를 가져야 함', () => {
    const threat: Threat = {
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

    expect(threat.id).toBe(1)
    expect(threat.threat_level).toBeGreaterThanOrEqual(1)
    expect(threat.threat_level).toBeLessThanOrEqual(3)
  })

  it('ThreatCreate 타입이 필수 필드만 요구해야 함', () => {
    const createData: ThreatCreate = {
      code: 'T002',
      name: '악성코드 감염',
      threat_level: 2,
    }

    expect(createData.code).toBeDefined()
    expect(createData.name).toBeDefined()
    expect(createData.threat_level).toBeDefined()
  })
})

describe('취약점 관련 타입', () => {
  it('Vulnerability 타입이 올바른 구조를 가져야 함', () => {
    const vulnerability: Vulnerability = {
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
    }

    expect(vulnerability.id).toBe(1)
    expect(vulnerability.vulnerability_level).toBeGreaterThanOrEqual(1)
    expect(vulnerability.vulnerability_level).toBeLessThanOrEqual(3)
  })

  it('VulnerabilityAssessment 타입이 점검 결과를 표현해야 함', () => {
    const assessment: VulnerabilityAssessment = {
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
      remarks: '긴급 패치 적용 예정',
      created_at: '2025-01-15T10:00:00Z',
    }

    expect(assessment.is_vulnerable).toBe(true)
    expect(['open', 'in_progress', 'closed', 'accepted']).toContain(assessment.remediation_status)
  })
})

describe('위험 시나리오 타입', () => {
  it('RiskScenario 타입이 올바른 구조를 가져야 함', () => {
    const scenario: RiskScenario = {
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
    }

    expect(scenario.status).toBe('in_progress')
    expect(['draft', 'in_progress', 'completed', 'cancelled']).toContain(scenario.status)
  })
})

describe('위험 평가 타입', () => {
  it('RiskAssessment 타입이 올바른 구조를 가져야 함', () => {
    const assessment: RiskAssessment = {
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
      remarks: 'DoA 초과 - 긴급 조치 필요',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: null,
      has_treatment_plan: true,
    }

    expect(assessment.risk_score).toBe(27)
    expect(['low', 'medium', 'high']).toContain(assessment.risk_level)
    expect(assessment.exceeds_doa).toBe(true)
  })
})

describe('DoA 관련 타입', () => {
  it('DoAConfig 타입이 올바른 구조를 가져야 함', () => {
    const config: DoAConfig = {
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

    expect(config.threshold_value).toBeGreaterThanOrEqual(1)
    expect(config.threshold_value).toBeLessThanOrEqual(27)
  })
})

describe('위험 처리 계획 타입', () => {
  it('RiskTreatmentPlan 타입이 올바른 구조를 가져야 함', () => {
    const plan: RiskTreatmentPlan = {
      id: 1,
      risk_assessment_id: 1,
      risk_score: 27,
      risk_level: 'high',
      asset_name: '웹서버-01',
      threat_name: '무단 접근',
      vulnerability_name: '패치 미적용',
      strategy: 'reduce',
      strategy_name: '위험 감소',
      description: '보안 패치 적용 및 접근 통제 강화',
      assignee_id: 10,
      assignee_name: '홍길동',
      due_date: '2025-02-15',
      budget: 5000000,
      status: 'in_progress',
      completed_at: null,
      created_at: '2025-01-15T10:00:00Z',
      updated_at: null,
      action_count: 2,
      latest_residual_risk: 9,
    }

    expect(['reduce', 'avoid', 'transfer', 'accept']).toContain(plan.strategy)
    expect(['planned', 'in_progress', 'completed', 'cancelled']).toContain(plan.status)
  })

  it('RiskTreatmentProgress 타입이 진행률 정보를 가져야 함', () => {
    const progress: RiskTreatmentProgress = {
      total: 10,
      completed: 3,
      in_progress: 5,
      planned: 2,
      cancelled: 0,
      completion_rate: 0.3,
    }

    expect(progress.completion_rate).toBe(0.3)
    expect(progress.total).toBe(progress.completed + progress.in_progress + progress.planned + progress.cancelled)
  })
})

describe('SOA 관련 타입', () => {
  it('SOARecord 타입이 올바른 구조를 가져야 함', () => {
    const record: SOARecord = {
      id: 1,
      control_item_id: 1,
      control_code: '1.1.1',
      control_title: '경영진의 참여',
      control_description: '정보보호 최고책임자 지정 및 조직 구성',
      is_applicable: true,
      exclusion_reason: null,
      implementation_status: 'fully_implemented',
      implementation_status_name: '완전 구현',
      implementation_evidence: '정보보호 위원회 운영 규정',
      related_assets: 'SRV-001, SRV-002',
      related_risks: 'R-001, R-002',
      remarks: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: null,
    }

    expect(['fully_implemented', 'partially_implemented', 'planned', 'not_implemented', 'not_applicable'])
      .toContain(record.implementation_status)
  })

  it('SOAExportRequest 타입이 올바른 형식을 요구해야 함', () => {
    const exportRequest: SOAExportRequest = {
      format: 'excel',
      template_type: 'isms_p',
    }

    expect(['excel', 'word']).toContain(exportRequest.format)
    expect(['isms_p', 'iso27001']).toContain(exportRequest.template_type)
  })
})

describe('상수 정의', () => {
  it('THREAT_LEVELS 상수가 정의되어야 함', () => {
    expect(THREAT_LEVELS).toHaveLength(3)
    expect(THREAT_LEVELS).toContainEqual({ value: 1, label: '하', color: '#52c41a' })
    expect(THREAT_LEVELS).toContainEqual({ value: 2, label: '중', color: '#faad14' })
    expect(THREAT_LEVELS).toContainEqual({ value: 3, label: '상', color: '#ff4d4f' })
  })

  it('TREATMENT_STRATEGIES 상수가 정의되어야 함', () => {
    expect(TREATMENT_STRATEGIES).toHaveLength(4)
    expect(TREATMENT_STRATEGIES.map(s => s.value)).toContain('reduce')
    expect(TREATMENT_STRATEGIES.map(s => s.value)).toContain('avoid')
    expect(TREATMENT_STRATEGIES.map(s => s.value)).toContain('transfer')
    expect(TREATMENT_STRATEGIES.map(s => s.value)).toContain('accept')
  })

  it('RISK_SCENARIO_STATUSES 상수가 정의되어야 함', () => {
    expect(RISK_SCENARIO_STATUSES).toHaveLength(4)
    const values = RISK_SCENARIO_STATUSES.map(s => s.value)
    expect(values).toContain('draft')
    expect(values).toContain('in_progress')
    expect(values).toContain('completed')
    expect(values).toContain('cancelled')
  })
})

describe('헬퍼 함수', () => {
  describe('레이블 변환 함수', () => {
    it('getThreatLevelLabel이 올바른 레이블을 반환해야 함', () => {
      expect(getThreatLevelLabel(1)).toBe('하')
      expect(getThreatLevelLabel(2)).toBe('중')
      expect(getThreatLevelLabel(3)).toBe('상')
      expect(getThreatLevelLabel(99)).toBe('알 수 없음')
    })

    it('getTreatmentStrategyLabel이 올바른 레이블을 반환해야 함', () => {
      expect(getTreatmentStrategyLabel('reduce')).toBe('위험 감소')
      expect(getTreatmentStrategyLabel('avoid')).toBe('위험 회피')
      expect(getTreatmentStrategyLabel('transfer')).toBe('위험 전가')
      expect(getTreatmentStrategyLabel('accept')).toBe('위험 수용')
      expect(getTreatmentStrategyLabel('unknown')).toBe('알 수 없음')
    })
  })

  describe('위험도 계산 함수', () => {
    it('calculateRiskScore가 올바르게 계산해야 함', () => {
      expect(calculateRiskScore(3, 3, 3)).toBe(27)
      expect(calculateRiskScore(2, 2, 2)).toBe(8)
      expect(calculateRiskScore(1, 1, 1)).toBe(1)
      expect(calculateRiskScore(3, 2, 1)).toBe(6)
    })

    it('classifyRiskLevel이 올바르게 분류해야 함', () => {
      expect(classifyRiskLevel(27)).toBe('high')
      expect(classifyRiskLevel(18)).toBe('high')
      expect(classifyRiskLevel(17)).toBe('medium')
      expect(classifyRiskLevel(9)).toBe('medium')
      expect(classifyRiskLevel(8)).toBe('low')
      expect(classifyRiskLevel(1)).toBe('low')
    })

    it('isHighRisk가 올바르게 판단해야 함', () => {
      expect(isHighRisk(27)).toBe(true)
      expect(isHighRisk(18)).toBe(true)
      expect(isHighRisk(17)).toBe(false)
      expect(isHighRisk(9)).toBe(false)
      expect(isHighRisk(1)).toBe(false)
    })

    it('formatRiskScore가 올바르게 포맷해야 함', () => {
      expect(formatRiskScore(27)).toContain('27')
      expect(formatRiskScore(27)).toContain('높음')
      expect(formatRiskScore(9)).toContain('9')
      expect(formatRiskScore(9)).toContain('중간')
      expect(formatRiskScore(1)).toContain('1')
      expect(formatRiskScore(1)).toContain('낮음')
    })
  })
})

describe('보고서 관련 타입', () => {
  it('RiskDistribution 타입이 올바른 구조를 가져야 함', () => {
    const distribution: RiskDistribution = {
      high: 5,
      medium: 20,
      low: 30,
      total: 55,
    }

    expect(distribution.total).toBe(distribution.high + distribution.medium + distribution.low)
  })

  it('RiskReportSummary 타입이 올바른 구조를 가져야 함', () => {
    const summary: RiskReportSummary = {
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

    expect(summary.total_risks).toBe(summary.risk_distribution.total)
  })
})
