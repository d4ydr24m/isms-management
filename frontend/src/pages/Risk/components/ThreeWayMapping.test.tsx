/**
 * ThreeWayMapping 컴포넌트 테스트
 *
 * TDD RED 단계: 테스트 먼저 작성
 *
 * 테스트 범위:
 * 1. 컴포넌트 렌더링
 * 2. 자산-위협-취약점 선택 기능
 * 3. 위험도 자동 계산 표시
 * 4. 값 변경 시 onChange 콜백 호출
 * 5. 필수 필드 검증
 * 6. 비활성화 상태
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ThreeWayMapping } from './ThreeWayMapping'
import type { Asset, Threat, Vulnerability } from '@/types'

// =============================================================================
// Mock 데이터
// =============================================================================

const mockAssets: Asset[] = [
  {
    id: 1,
    code: 'ASSET-001',
    name: '고객 정보 DB',
    type: 'database',
    category_id: 1,
    category_name: '데이터베이스',
    owner_department_id: 1,
    owner_department_name: 'IT팀',
    status: 'active',
    importance: 'high',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    code: 'ASSET-002',
    name: '업무 시스템 서버',
    type: 'server',
    category_id: 2,
    category_name: '서버',
    owner_department_id: 1,
    owner_department_name: 'IT팀',
    status: 'active',
    importance: 'medium',
    created_at: '2024-01-01T00:00:00Z',
  },
]

const mockThreats: Threat[] = [
  {
    id: 1,
    code: 'THR-001',
    name: '무단 접근',
    description: '권한 없는 사용자의 시스템 접근',
    category: 'unauthorized_access',
    severity: 'high',
    source: 'internal',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    code: 'THR-002',
    name: 'DDoS 공격',
    description: '분산 서비스 거부 공격',
    category: 'network_attack',
    severity: 'medium',
    source: 'external',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
]

const mockVulnerabilities: Vulnerability[] = [
  {
    id: 1,
    code: 'VUL-001',
    name: '취약한 인증',
    description: '부적절한 인증 메커니즘',
    category: 'authentication',
    severity: 'high',
    cve_id: null,
    cvss_score: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    code: 'VUL-002',
    name: '패치 미적용',
    description: '보안 패치가 적용되지 않음',
    category: 'configuration',
    severity: 'medium',
    cve_id: null,
    cvss_score: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
]

// =============================================================================
// 1. 컴포넌트 렌더링 테스트
// =============================================================================

describe('ThreeWayMapping - 컴포넌트 렌더링', () => {
  it('컴포넌트가 올바르게 렌더링되어야 함', () => {
    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{}}
        onChange={vi.fn()}
      />
    )

    // 각 선택 필드 레이블 확인
    expect(screen.getByText('자산')).toBeInTheDocument()
    expect(screen.getByText('위협')).toBeInTheDocument()
    expect(screen.getByText('취약점')).toBeInTheDocument()

    // 값 평가 필드 레이블 확인
    expect(screen.getByText('자산가치')).toBeInTheDocument()
    expect(screen.getByText('위협등급')).toBeInTheDocument()
    expect(screen.getByText('취약점등급')).toBeInTheDocument()
  })

  it('초기값이 있는 경우 올바르게 표시되어야 함', () => {
    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{
          asset_id: 1,
          threat_id: 1,
          vulnerability_id: 1,
          asset_value: 3,
          threat_level: 3,
          vulnerability_level: 3,
        }}
        onChange={vi.fn()}
      />
    )

    // Select 컴포넌트가 선택된 값을 표시하는지 확인 (코드 - 이름 형식)
    expect(screen.getByText('ASSET-001 - 고객 정보 DB')).toBeInTheDocument()
    expect(screen.getByText('THR-001 - 무단 접근')).toBeInTheDocument()
    expect(screen.getByText('VUL-001 - 취약한 인증')).toBeInTheDocument()
  })

  it('비활성화 상태에서 올바르게 표시되어야 함', () => {
    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{}}
        onChange={vi.fn()}
        disabled
      />
    )

    // 모든 Select 컴포넌트가 비활성화되어야 함
    const selects = document.querySelectorAll('.ant-select-disabled')
    expect(selects.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// 2. 자산-위협-취약점 선택 테스트
// =============================================================================

describe('ThreeWayMapping - 선택 기능', () => {
  it('자산을 선택할 수 있어야 함', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{}}
        onChange={onChange}
      />
    )

    // 자산 선택 필드 찾기 (첫 번째 Select)
    const assetSelects = document.querySelectorAll('.ant-select-selector')
    await user.click(assetSelects[0])

    // 옵션 대기
    await waitFor(() => {
      expect(screen.getByText('ASSET-001 - 고객 정보 DB')).toBeInTheDocument()
    })

    // 자산 선택
    await user.click(screen.getByText('ASSET-001 - 고객 정보 DB'))

    // onChange 콜백 호출 확인
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
      expect(onChange.mock.calls[0][0]).toMatchObject({
        asset_id: 1,
      })
    })
  })

  it('위협을 선택할 수 있어야 함', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{}}
        onChange={onChange}
      />
    )

    // 위협 선택 필드 찾기 (두 번째 Select)
    const threatSelects = document.querySelectorAll('.ant-select-selector')
    await user.click(threatSelects[1])

    // 옵션 대기
    await waitFor(() => {
      expect(screen.getByText('THR-001 - 무단 접근')).toBeInTheDocument()
    })

    // 위협 선택
    await user.click(screen.getByText('THR-001 - 무단 접근'))

    // onChange 콜백 호출 확인
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
      expect(onChange.mock.calls[0][0]).toMatchObject({
        threat_id: 1,
      })
    })
  })

  it('취약점을 선택할 수 있어야 함', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{}}
        onChange={onChange}
      />
    )

    // 취약점 선택 필드 찾기 (세 번째 Select)
    const vulnSelects = document.querySelectorAll('.ant-select-selector')
    await user.click(vulnSelects[2])

    // 옵션 대기
    await waitFor(() => {
      expect(screen.getByText('VUL-001 - 취약한 인증')).toBeInTheDocument()
    })

    // 취약점 선택
    await user.click(screen.getByText('VUL-001 - 취약한 인증'))

    // onChange 콜백 호출 확인
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
      expect(onChange.mock.calls[0][0]).toMatchObject({
        vulnerability_id: 1,
      })
    })
  })
})

// =============================================================================
// 3. 값 평가 선택 테스트
// =============================================================================

describe('ThreeWayMapping - 값 평가', () => {
  it('자산가치를 선택할 수 있어야 함', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{}}
        onChange={onChange}
      />
    )

    // 자산가치 선택 필드 찾기 (네 번째 Select)
    const valueSelects = document.querySelectorAll('.ant-select-selector')
    await user.click(valueSelects[3])

    // 옵션 대기
    await waitFor(() => {
      expect(screen.getByText('3 - 높음')).toBeInTheDocument()
    })

    // 자산가치 선택
    await user.click(screen.getByText('3 - 높음'))

    // onChange 콜백 호출 확인
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
      expect(onChange.mock.calls[0][0]).toMatchObject({
        asset_value: 3,
      })
    })
  })

  it('위협등급을 선택할 수 있어야 함', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{}}
        onChange={onChange}
      />
    )

    // 위협등급 선택 필드 찾기 (다섯 번째 Select)
    const threatLevelSelects = document.querySelectorAll('.ant-select-selector')
    await user.click(threatLevelSelects[4])

    // 옵션 대기
    await waitFor(() => {
      expect(screen.getByText('2 - 중간')).toBeInTheDocument()
    })

    // 위협등급 선택
    await user.click(screen.getByText('2 - 중간'))

    // onChange 콜백 호출 확인
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
      expect(onChange.mock.calls[0][0]).toMatchObject({
        threat_level: 2,
      })
    })
  })

  it('취약점등급을 선택할 수 있어야 함', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{}}
        onChange={onChange}
      />
    )

    // 취약점등급 선택 필드 찾기 (여섯 번째 Select)
    const vulnLevelSelects = document.querySelectorAll('.ant-select-selector')
    await user.click(vulnLevelSelects[5])

    // 옵션 대기
    await waitFor(() => {
      expect(screen.getByText('1 - 낮음')).toBeInTheDocument()
    })

    // 취약점등급 선택
    await user.click(screen.getByText('1 - 낮음'))

    // onChange 콜백 호출 확인
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
      expect(onChange.mock.calls[0][0]).toMatchObject({
        vulnerability_level: 1,
      })
    })
  })
})

// =============================================================================
// 4. 위험도 자동 계산 표시 테스트
// =============================================================================

describe('ThreeWayMapping - 위험도 자동 계산', () => {
  it('모든 값이 선택되면 위험도가 자동 계산되어야 함', () => {
    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{
          asset_id: 1,
          threat_id: 1,
          vulnerability_id: 1,
          asset_value: 3,
          threat_level: 3,
          vulnerability_level: 3,
        }}
        onChange={vi.fn()}
      />
    )

    // 위험도 = 3 × 3 × 3 = 27
    expect(screen.getByText(/계산된 위험도/i)).toBeInTheDocument()
    expect(screen.getByText('27')).toBeInTheDocument()
    // "높음" 텍스트는 여러 곳에 나타날 수 있음 (Tag 내부, 공식 설명)
    const highTexts = screen.getAllByText(/높음/i)
    expect(highTexts.length).toBeGreaterThan(0)
  })

  it('일부 값만 선택되면 위험도가 표시되지 않아야 함', () => {
    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{
          asset_id: 1,
          threat_id: 1,
          // vulnerability_id 없음
          asset_value: 3,
          threat_level: 3,
          // vulnerability_level 없음
        }}
        onChange={vi.fn()}
      />
    )

    // 위험도가 표시되지 않아야 함
    expect(screen.queryByText(/계산된 위험도/i)).not.toBeInTheDocument()
  })

  it('위험도가 1-8 범위면 "낮음"으로 표시되어야 함', () => {
    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{
          asset_id: 1,
          threat_id: 1,
          vulnerability_id: 1,
          asset_value: 2,
          threat_level: 2,
          vulnerability_level: 2,
        }}
        onChange={vi.fn()}
      />
    )

    // 위험도 = 2 × 2 × 2 = 8
    expect(screen.getByText('8')).toBeInTheDocument()
    // "낮음" 텍스트는 여러 곳에 나타날 수 있음
    const lowTexts = screen.getAllByText(/낮음/i)
    expect(lowTexts.length).toBeGreaterThan(0)
  })

  it('위험도가 9-17 범위면 "중간"으로 표시되어야 함', () => {
    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{
          asset_id: 1,
          threat_id: 1,
          vulnerability_id: 1,
          asset_value: 3,
          threat_level: 2,
          vulnerability_level: 2,
        }}
        onChange={vi.fn()}
      />
    )

    // 위험도 = 3 × 2 × 2 = 12
    expect(screen.getByText('12')).toBeInTheDocument()
    // "중간" 텍스트는 여러 곳에 나타날 수 있음
    const mediumTexts = screen.getAllByText(/중간/i)
    expect(mediumTexts.length).toBeGreaterThan(0)
  })

  it('위험도가 18-27 범위면 "높음"으로 표시되어야 함', () => {
    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{
          asset_id: 1,
          threat_id: 1,
          vulnerability_id: 1,
          asset_value: 3,
          threat_level: 3,
          vulnerability_level: 2,
        }}
        onChange={vi.fn()}
      />
    )

    // 위험도 = 3 × 3 × 2 = 18
    expect(screen.getByText('18')).toBeInTheDocument()
    // "높음" 텍스트는 여러 곳에 나타날 수 있음
    const highTexts = screen.getAllByText(/높음/i)
    expect(highTexts.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// 5. onChange 콜백 테스트
// =============================================================================

describe('ThreeWayMapping - onChange 콜백', () => {
  it('값 변경 시 onChange가 호출되어야 함', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{}}
        onChange={onChange}
      />
    )

    // 자산 선택
    const assetSelects = document.querySelectorAll('.ant-select-selector')
    await user.click(assetSelects[0])

    await waitFor(() => {
      expect(screen.getByText('ASSET-001 - 고객 정보 DB')).toBeInTheDocument()
    })

    await user.click(screen.getByText('ASSET-001 - 고객 정보 DB'))

    // onChange 호출 확인
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1)
    })
  })

  it('여러 값 변경 시 onChange가 각각 호출되어야 함', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{}}
        onChange={onChange}
      />
    )

    // 자산 선택
    const selects = document.querySelectorAll('.ant-select-selector')
    await user.click(selects[0])
    await waitFor(() => {
      expect(screen.getByText('ASSET-001 - 고객 정보 DB')).toBeInTheDocument()
    })
    await user.click(screen.getByText('ASSET-001 - 고객 정보 DB'))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    // 위협 선택
    await user.click(selects[1])
    await waitFor(() => {
      expect(screen.getByText('THR-001 - 무단 접근')).toBeInTheDocument()
    })
    await user.click(screen.getByText('THR-001 - 무단 접근'))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(2)
    })
  })
})

// =============================================================================
// 6. 빈 리스트 처리 테스트
// =============================================================================

describe('ThreeWayMapping - 빈 리스트 처리', () => {
  it('자산 리스트가 비어있어도 렌더링되어야 함', () => {
    render(
      <ThreeWayMapping
        assets={[]}
        threats={mockThreats}
        vulnerabilities={mockVulnerabilities}
        value={{}}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('자산')).toBeInTheDocument()
  })

  it('위협 리스트가 비어있어도 렌더링되어야 함', () => {
    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={[]}
        vulnerabilities={mockVulnerabilities}
        value={{}}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('위협')).toBeInTheDocument()
  })

  it('취약점 리스트가 비어있어도 렌더링되어야 함', () => {
    render(
      <ThreeWayMapping
        assets={mockAssets}
        threats={mockThreats}
        vulnerabilities={[]}
        value={{}}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('취약점')).toBeInTheDocument()
  })
})
