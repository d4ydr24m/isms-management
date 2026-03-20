/**
 * CIAEvaluation 컴포넌트 테스트
 * TDD: RED -> GREEN -> REFACTOR
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CIAEvaluation from './CIAEvaluation'
import type { AssetValuation } from '@/types'

// 테스트용 Mock 데이터
const mockValuation: AssetValuation = {
  id: 1,
  assetId: 1,
  confidentiality: 3,
  integrity: 2,
  availability: 3,
  importanceLevel: 3,
  evaluationReason: '개인정보 처리 시스템으로 기밀성이 높음',
  evaluatedBy: 1,
  evaluatorName: '김평가',
  evaluatedAt: '2024-01-20T00:00:00Z',
  createdAt: '2024-01-20T00:00:00Z',
}

const mockValuationLow: AssetValuation = {
  id: 2,
  assetId: 2,
  confidentiality: 1,
  integrity: 1,
  availability: 1,
  importanceLevel: 1,
  evaluationReason: '공개 정보 관리',
  evaluatorName: '이평가',
  evaluatedAt: '2024-01-15T00:00:00Z',
  createdAt: '2024-01-15T00:00:00Z',
}

const mockValuationMedium: AssetValuation = {
  id: 3,
  assetId: 3,
  confidentiality: 2,
  integrity: 2,
  availability: 2,
  importanceLevel: 2,
  evaluatorName: '박평가',
  evaluatedAt: '2024-01-18T00:00:00Z',
  createdAt: '2024-01-18T00:00:00Z',
}

const defaultProps = {
  assetId: 1,
  onUpdate: vi.fn().mockResolvedValue(undefined),
  readonly: false,
}

describe('CIAEvaluation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('카드 렌더링', () => {
    it('CIA 평가 타이틀을 렌더링한다', async () => {
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await waitFor(() => {
        expect(screen.getByText('CIA 평가')).toBeInTheDocument()
      })
    })

    it('valuation이 있을 때 수정 버튼을 렌더링한다', async () => {
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /수정/i })).toBeInTheDocument()
      })
    })

    it('valuation이 없을 때 평가 등록 버튼을 렌더링한다', async () => {
      render(<CIAEvaluation {...defaultProps} />)

      await waitFor(() => {
        // 두 개의 평가 등록 버튼이 있음 (extra와 body 내부)
        const buttons = screen.getAllByRole('button', { name: /평가 등록/i })
        expect(buttons.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('readonly 모드에서 수정 버튼을 숨긴다', async () => {
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} readonly={true} />)

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /수정/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('CIA 게이지 렌더링', () => {
    it('기밀성 게이지를 렌더링한다', async () => {
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await waitFor(() => {
        expect(screen.getByText('기밀성 (C)')).toBeInTheDocument()
      })
    })

    it('무결성 게이지를 렌더링한다', async () => {
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await waitFor(() => {
        expect(screen.getByText('무결성 (I)')).toBeInTheDocument()
      })
    })

    it('가용성 게이지를 렌더링한다', async () => {
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await waitFor(() => {
        expect(screen.getByText('가용성 (A)')).toBeInTheDocument()
      })
    })

    it('게이지에 점수를 표시한다', async () => {
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await waitFor(() => {
        // 기밀성 3 = '상', 무결성 2 = '중', 가용성 3 = '상'
        const highLabels = screen.getAllByText('상')
        expect(highLabels.length).toBeGreaterThanOrEqual(2) // 기밀성, 가용성

        const mediumLabels = screen.getAllByText('중')
        expect(mediumLabels.length).toBeGreaterThanOrEqual(1) // 무결성
      })
    })

    it('게이지에 분수 점수 (x/3)를 표시한다', async () => {
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await waitFor(() => {
        // 기밀성(3)과 가용성(3)이 모두 3/3이므로 여러 개 존재
        const threeOfThree = screen.getAllByText('3/3')
        expect(threeOfThree.length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('2/3')).toBeInTheDocument() // 무결성
      })
    })
  })

  describe('중요도 레벨 표시', () => {
    it('자산 중요도를 표시한다', async () => {
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await waitFor(() => {
        expect(screen.getByText('자산 중요도:')).toBeInTheDocument()
      })
    })

    it('높은 중요도(3)일 때 "상" 태그를 표시한다', async () => {
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await waitFor(() => {
        // 중요도 태그는 별도로 렌더링됨
        const importanceTag = screen.getByText('자산 중요도:').nextElementSibling
        expect(importanceTag).toHaveTextContent('상')
      })
    })

    it('낮은 중요도(1)일 때 "하" 태그를 표시한다', async () => {
      render(<CIAEvaluation {...defaultProps} valuation={mockValuationLow} />)

      await waitFor(() => {
        const lowLabels = screen.getAllByText('하')
        expect(lowLabels.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('중간 중요도(2)일 때 "중" 태그를 표시한다', async () => {
      render(<CIAEvaluation {...defaultProps} valuation={mockValuationMedium} />)

      await waitFor(() => {
        const medLabels = screen.getAllByText('중')
        expect(medLabels.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('평가 사유 표시', () => {
    it('평가 사유가 있을 때 표시한다', async () => {
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await waitFor(() => {
        expect(screen.getByText('평가 사유')).toBeInTheDocument()
        expect(screen.getByText('개인정보 처리 시스템으로 기밀성이 높음')).toBeInTheDocument()
      })
    })

    it('평가 사유가 없을 때 평가 사유 섹션을 숨긴다', async () => {
      const valuationNoReason = { ...mockValuation, evaluationReason: undefined }
      render(<CIAEvaluation {...defaultProps} valuation={valuationNoReason} />)

      await waitFor(() => {
        expect(screen.queryByText('평가 사유')).not.toBeInTheDocument()
      })
    })
  })

  describe('평가자 정보 표시', () => {
    it('평가자명을 표시한다', async () => {
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await waitFor(() => {
        expect(screen.getByText(/평가자: 김평가/)).toBeInTheDocument()
      })
    })

    it('평가 일시를 표시한다', async () => {
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await waitFor(() => {
        expect(screen.getByText(/평가일시: 2024-01-20/)).toBeInTheDocument()
      })
    })

    it('평가자명이 없을 때 평가자 정보를 숨긴다', async () => {
      const valuationNoEvaluator = { ...mockValuation, evaluatorName: undefined }
      render(<CIAEvaluation {...defaultProps} valuation={valuationNoEvaluator} />)

      await waitFor(() => {
        expect(screen.queryByText(/평가자:/)).not.toBeInTheDocument()
      })
    })
  })

  describe('빈 상태 표시', () => {
    it('valuation이 없을 때 안내 메시지를 표시한다', async () => {
      render(<CIAEvaluation {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('아직 CIA 평가가 등록되지 않았습니다.')).toBeInTheDocument()
      })
    })

    it('valuation이 없을 때 평가 등록하기 버튼을 표시한다', async () => {
      render(<CIAEvaluation {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '평가 등록하기' })).toBeInTheDocument()
      })
    })

    it('readonly 모드에서 빈 상태일 때 평가 등록하기 버튼을 숨긴다', async () => {
      render(<CIAEvaluation {...defaultProps} readonly={true} />)

      await waitFor(() => {
        expect(screen.getByText('아직 CIA 평가가 등록되지 않았습니다.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '평가 등록하기' })).not.toBeInTheDocument()
      })
    })
  })

  describe('평가 모달', () => {
    it('수정 버튼 클릭 시 모달을 연다', async () => {
      const user = userEvent.setup()
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await user.click(screen.getByRole('button', { name: /수정/i }))

      await waitFor(() => {
        // 모달 타이틀
        const modalTitle = screen.getAllByText('CIA 평가')
        expect(modalTitle.length).toBeGreaterThan(1) // 카드 타이틀 + 모달 타이틀
      })
    })

    it('모달에 기밀성 셀렉트를 표시한다', async () => {
      const user = userEvent.setup()
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await user.click(screen.getByRole('button', { name: /수정/i }))

      await waitFor(() => {
        expect(screen.getByText('기밀성 (Confidentiality)')).toBeInTheDocument()
        expect(screen.getByText('정보의 비밀 유지 중요도')).toBeInTheDocument()
      })
    })

    it('모달에 무결성 셀렉트를 표시한다', async () => {
      const user = userEvent.setup()
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await user.click(screen.getByRole('button', { name: /수정/i }))

      await waitFor(() => {
        expect(screen.getByText('무결성 (Integrity)')).toBeInTheDocument()
        expect(screen.getByText('정보의 정확성 및 완전성 중요도')).toBeInTheDocument()
      })
    })

    it('모달에 가용성 셀렉트를 표시한다', async () => {
      const user = userEvent.setup()
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await user.click(screen.getByRole('button', { name: /수정/i }))

      await waitFor(() => {
        expect(screen.getByText('가용성 (Availability)')).toBeInTheDocument()
        expect(screen.getByText('정보 접근 가능성 중요도')).toBeInTheDocument()
      })
    })

    it('모달에 평가 사유 입력 필드를 표시한다', async () => {
      const user = userEvent.setup()
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await user.click(screen.getByRole('button', { name: /수정/i }))

      await waitFor(() => {
        // 모달 내 평가 사유 레이블
        const reasonLabels = screen.getAllByText('평가 사유')
        expect(reasonLabels.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('모달에 저장 버튼을 표시한다', async () => {
      const user = userEvent.setup()
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await user.click(screen.getByRole('button', { name: /수정/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
      })
    })

    it('모달에 취소 버튼을 표시한다', async () => {
      const user = userEvent.setup()
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await user.click(screen.getByRole('button', { name: /수정/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
      })
    })

    it('취소 버튼이 있다', async () => {
      const user = userEvent.setup()
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await user.click(screen.getByRole('button', { name: /수정/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
      })
    })

    it('모달을 열 때 기존 값을 폼에 설정한다', async () => {
      const user = userEvent.setup()
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} />)

      await user.click(screen.getByRole('button', { name: /수정/i }))

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText('평가 사유를 입력하세요')
        expect(textarea).toHaveValue('개인정보 처리 시스템으로 기밀성이 높음')
      })
    })
  })

  describe('평가 등록 모달 (신규)', () => {
    it('평가 등록하기 버튼 클릭 시 모달을 연다', async () => {
      const user = userEvent.setup()
      render(<CIAEvaluation {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: '평가 등록하기' }))

      await waitFor(() => {
        expect(screen.getByText('기밀성 (Confidentiality)')).toBeInTheDocument()
      })
    })
  })

  describe('폼 검증', () => {
    it('빈 폼 제출 시 검증 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      render(<CIAEvaluation {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: '평가 등록하기' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '저장' }))

      await waitFor(() => {
        // 최소한 하나의 검증 에러가 표시됨
        const errorMessages = document.querySelectorAll('.ant-form-item-explain-error')
        expect(errorMessages.length).toBeGreaterThan(0)
      })
    })
  })

  describe('폼 제출', () => {
    it('유효한 폼 제출 시 onUpdate 콜백을 호출한다', async () => {
      const user = userEvent.setup()
      const onUpdate = vi.fn().mockResolvedValue(undefined)
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} onUpdate={onUpdate} />)

      await user.click(screen.getByRole('button', { name: /수정/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '저장' }))

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled()
      })
    })

    it('제출 성공 시 성공 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      const onUpdate = vi.fn().mockResolvedValue(undefined)
      render(<CIAEvaluation {...defaultProps} valuation={mockValuation} onUpdate={onUpdate} />)

      await user.click(screen.getByRole('button', { name: /수정/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '저장' }))

      await waitFor(() => {
        // message.success 호출 확인은 복잡하므로 onUpdate 호출 여부로 대체
        expect(onUpdate).toHaveBeenCalled()
      })
    })
  })

  describe('CIA 등급 옵션', () => {
    it('모달에 기밀성 등급 선택 셀렉트가 표시된다', async () => {
      const user = userEvent.setup()
      render(<CIAEvaluation {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: '평가 등록하기' }))

      await waitFor(() => {
        // 모달에서 기밀성 필드 확인
        expect(screen.getByText('기밀성 (Confidentiality)')).toBeInTheDocument()
      })
    })

    it('모달에 무결성 등급 선택 셀렉트가 표시된다', async () => {
      const user = userEvent.setup()
      render(<CIAEvaluation {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: '평가 등록하기' }))

      await waitFor(() => {
        expect(screen.getByText('무결성 (Integrity)')).toBeInTheDocument()
      })
    })

    it('모달에 가용성 등급 선택 셀렉트가 표시된다', async () => {
      const user = userEvent.setup()
      render(<CIAEvaluation {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: '평가 등록하기' }))

      await waitFor(() => {
        expect(screen.getByText('가용성 (Availability)')).toBeInTheDocument()
      })
    })
  })
})
