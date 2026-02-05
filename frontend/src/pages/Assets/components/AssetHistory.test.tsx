/**
 * AssetHistory 컴포넌트 테스트
 * TDD: RED -> GREEN -> REFACTOR
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AssetHistory from './AssetHistory'
import type { AssetHistory as AssetHistoryType, AssetChangeType } from '@/types'

// 테스트용 Mock 데이터
const mockHistoryCreated: AssetHistoryType = {
  id: 1,
  assetId: 1,
  changeType: 'created',
  changedBy: 1,
  changerName: '김등록',
  changedAt: '2024-01-15T09:30:00Z',
  remarks: '자산 최초 등록',
}

const mockHistoryUpdated: AssetHistoryType = {
  id: 2,
  assetId: 1,
  changeType: 'updated',
  fieldName: 'name',
  oldValue: '기존 서버명',
  newValue: '새로운 서버명',
  changedBy: 2,
  changerName: '이수정',
  changedAt: '2024-01-16T14:20:00Z',
}

const mockHistoryStatusChanged: AssetHistoryType = {
  id: 3,
  assetId: 1,
  changeType: 'status_changed',
  fieldName: 'status',
  oldValue: 'introduced',
  newValue: 'operating',
  changedBy: 3,
  changerName: '박운영',
  changedAt: '2024-01-17T10:00:00Z',
}

const mockHistoryValuationChanged: AssetHistoryType = {
  id: 4,
  assetId: 1,
  changeType: 'valuation_changed',
  fieldName: 'confidentiality',
  oldValue: '2',
  newValue: '3',
  changedBy: 4,
  changerName: '최평가',
  changedAt: '2024-01-18T16:45:00Z',
}

const mockHistoryAssignmentChanged: AssetHistoryType = {
  id: 5,
  assetId: 1,
  changeType: 'assignment_changed',
  oldValue: '김담당',
  newValue: '이담당',
  changedBy: 5,
  changerName: '정관리',
  changedAt: '2024-01-19T11:30:00Z',
}

const mockHistoryDisposed: AssetHistoryType = {
  id: 6,
  assetId: 1,
  changeType: 'disposed',
  changedBy: 6,
  changerName: '한폐기',
  changedAt: '2024-01-20T17:00:00Z',
  remarks: '노후화로 인한 폐기',
}

const mockHistoryNoChanger: AssetHistoryType = {
  id: 7,
  assetId: 1,
  changeType: 'updated',
  fieldName: 'location',
  oldValue: '서울',
  newValue: '부산',
  changedAt: '2024-01-21T09:00:00Z',
}

const mockHistoryNoOldValue: AssetHistoryType = {
  id: 8,
  assetId: 1,
  changeType: 'updated',
  fieldName: 'description',
  newValue: '새 설명 추가',
  changedBy: 7,
  changerName: '조추가',
  changedAt: '2024-01-22T10:00:00Z',
}

const mockHistoryNoNewValue: AssetHistoryType = {
  id: 9,
  assetId: 1,
  changeType: 'updated',
  fieldName: 'hostname',
  oldValue: 'old-hostname',
  changedBy: 8,
  changerName: '윤삭제',
  changedAt: '2024-01-23T11:00:00Z',
}

const allMockHistory: AssetHistoryType[] = [
  mockHistoryCreated,
  mockHistoryUpdated,
  mockHistoryStatusChanged,
  mockHistoryValuationChanged,
  mockHistoryAssignmentChanged,
  mockHistoryDisposed,
]

describe('AssetHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('카드 렌더링', () => {
    it('변경 이력 타이틀을 렌더링한다', async () => {
      render(<AssetHistory history={allMockHistory} />)

      await waitFor(() => {
        expect(screen.getByText('변경 이력')).toBeInTheDocument()
      })
    })

    it('로딩 상태를 표시한다', async () => {
      render(<AssetHistory history={[]} loading={true} />)

      await waitFor(() => {
        // Ant Design Card의 loading 상태는 skeleton을 사용
        const card = document.querySelector('.ant-card-loading')
        expect(card).toBeInTheDocument()
      })
    })
  })

  describe('타임라인 렌더링', () => {
    it('이력이 있을 때 타임라인을 렌더링한다', async () => {
      render(<AssetHistory history={allMockHistory} />)

      await waitFor(() => {
        // Timeline 컴포넌트의 item 확인
        const timeline = document.querySelector('.ant-timeline')
        expect(timeline).toBeInTheDocument()
      })
    })

    it('이력 항목들을 렌더링한다', async () => {
      render(<AssetHistory history={allMockHistory} />)

      await waitFor(() => {
        // 변경 유형 태그 확인
        expect(screen.getByText('생성')).toBeInTheDocument()
        expect(screen.getByText('수정')).toBeInTheDocument()
        expect(screen.getByText('상태 변경')).toBeInTheDocument()
        expect(screen.getByText('평가 변경')).toBeInTheDocument()
        expect(screen.getByText('담당자 변경')).toBeInTheDocument()
        expect(screen.getByText('폐기')).toBeInTheDocument()
      })
    })
  })

  describe('변경 유형별 렌더링', () => {
    describe('생성 (created)', () => {
      it('생성 태그를 녹색으로 렌더링한다', async () => {
        render(<AssetHistory history={[mockHistoryCreated]} />)

        await waitFor(() => {
          const tag = screen.getByText('생성')
          expect(tag).toBeInTheDocument()
          expect(tag.closest('.ant-tag')).toHaveClass('ant-tag-green')
        })
      })

      it('생성 메시지를 표시한다', async () => {
        render(<AssetHistory history={[mockHistoryCreated]} />)

        await waitFor(() => {
          expect(screen.getByText('자산이 등록되었습니다.')).toBeInTheDocument()
        })
      })
    })

    describe('수정 (updated)', () => {
      it('수정 태그를 파란색으로 렌더링한다', async () => {
        render(<AssetHistory history={[mockHistoryUpdated]} />)

        await waitFor(() => {
          const tag = screen.getByText('수정')
          expect(tag).toBeInTheDocument()
          expect(tag.closest('.ant-tag')).toHaveClass('ant-tag-blue')
        })
      })

      it('변경 필드명을 한글로 표시한다', async () => {
        render(<AssetHistory history={[mockHistoryUpdated]} />)

        await waitFor(() => {
          expect(screen.getByText('자산명')).toBeInTheDocument()
        })
      })

      it('변경 전 값을 취소선으로 표시한다', async () => {
        render(<AssetHistory history={[mockHistoryUpdated]} />)

        await waitFor(() => {
          const oldValue = screen.getByText('기존 서버명')
          expect(oldValue).toBeInTheDocument()
          // Typography의 delete 속성 확인
          expect(oldValue.closest('del') || oldValue.closest('.ant-typography-delete')).toBeTruthy()
        })
      })

      it('변경 후 값을 표시한다', async () => {
        render(<AssetHistory history={[mockHistoryUpdated]} />)

        await waitFor(() => {
          expect(screen.getByText('새로운 서버명')).toBeInTheDocument()
        })
      })
    })

    describe('상태 변경 (status_changed)', () => {
      it('상태 변경 태그를 주황색으로 렌더링한다', async () => {
        render(<AssetHistory history={[mockHistoryStatusChanged]} />)

        await waitFor(() => {
          const tag = screen.getByText('상태 변경')
          expect(tag).toBeInTheDocument()
          expect(tag.closest('.ant-tag')).toHaveClass('ant-tag-orange')
        })
      })

      it('상태 필드명을 한글로 표시한다', async () => {
        render(<AssetHistory history={[mockHistoryStatusChanged]} />)

        await waitFor(() => {
          expect(screen.getByText('상태')).toBeInTheDocument()
        })
      })
    })

    describe('평가 변경 (valuation_changed)', () => {
      it('평가 변경 태그를 보라색으로 렌더링한다', async () => {
        render(<AssetHistory history={[mockHistoryValuationChanged]} />)

        await waitFor(() => {
          const tag = screen.getByText('평가 변경')
          expect(tag).toBeInTheDocument()
          expect(tag.closest('.ant-tag')).toHaveClass('ant-tag-purple')
        })
      })

      it('CIA 필드명을 한글로 표시한다', async () => {
        render(<AssetHistory history={[mockHistoryValuationChanged]} />)

        await waitFor(() => {
          expect(screen.getByText('기밀성')).toBeInTheDocument()
        })
      })
    })

    describe('담당자 변경 (assignment_changed)', () => {
      it('담당자 변경 태그를 청록색으로 렌더링한다', async () => {
        render(<AssetHistory history={[mockHistoryAssignmentChanged]} />)

        await waitFor(() => {
          const tag = screen.getByText('담당자 변경')
          expect(tag).toBeInTheDocument()
          expect(tag.closest('.ant-tag')).toHaveClass('ant-tag-cyan')
        })
      })

      it('담당자 변경 메시지를 표시한다', async () => {
        render(<AssetHistory history={[mockHistoryAssignmentChanged]} />)

        await waitFor(() => {
          expect(screen.getByText('담당자 변경:')).toBeInTheDocument()
        })
      })

      it('이전 담당자와 새 담당자를 표시한다', async () => {
        render(<AssetHistory history={[mockHistoryAssignmentChanged]} />)

        await waitFor(() => {
          expect(screen.getByText('김담당')).toBeInTheDocument()
          expect(screen.getByText('이담당')).toBeInTheDocument()
        })
      })
    })

    describe('폐기 (disposed)', () => {
      it('폐기 태그를 빨간색으로 렌더링한다', async () => {
        render(<AssetHistory history={[mockHistoryDisposed]} />)

        await waitFor(() => {
          const tag = screen.getByText('폐기')
          expect(tag).toBeInTheDocument()
          expect(tag.closest('.ant-tag')).toHaveClass('ant-tag-red')
        })
      })

      it('폐기 메시지를 표시한다', async () => {
        render(<AssetHistory history={[mockHistoryDisposed]} />)

        await waitFor(() => {
          expect(screen.getByText('자산이 폐기 처리되었습니다.')).toBeInTheDocument()
        })
      })
    })
  })

  describe('변경자 정보 표시', () => {
    it('변경자명을 표시한다', async () => {
      render(<AssetHistory history={[mockHistoryCreated]} />)

      await waitFor(() => {
        expect(screen.getByText('변경자: 김등록')).toBeInTheDocument()
      })
    })

    it('변경자명이 없을 때 변경자 정보를 숨긴다', async () => {
      render(<AssetHistory history={[mockHistoryNoChanger]} />)

      await waitFor(() => {
        expect(screen.queryByText(/변경자:/)).not.toBeInTheDocument()
      })
    })
  })

  describe('변경 시간 표시', () => {
    it('변경 시간을 포맷팅하여 표시한다', async () => {
      render(<AssetHistory history={[mockHistoryCreated]} />)

      await waitFor(() => {
        // 한국 시간으로 포맷팅됨 (2024. 01. 15. 09:30 형식 또는 유사)
        // toLocaleString('ko-KR') 사용
        const timeText = screen.getByText(/2024/)
        expect(timeText).toBeInTheDocument()
      })
    })
  })

  describe('비고(remarks) 표시', () => {
    it('비고가 있을 때 표시한다', async () => {
      render(<AssetHistory history={[mockHistoryCreated]} />)

      await waitFor(() => {
        expect(screen.getByText('비고: 자산 최초 등록')).toBeInTheDocument()
      })
    })

    it('비고가 없을 때 비고 섹션을 숨긴다', async () => {
      render(<AssetHistory history={[mockHistoryUpdated]} />)

      await waitFor(() => {
        expect(screen.queryByText(/비고:/)).not.toBeInTheDocument()
      })
    })
  })

  describe('빈 상태 표시', () => {
    it('이력이 없을 때 빈 상태 메시지를 표시한다', async () => {
      render(<AssetHistory history={[]} />)

      await waitFor(() => {
        expect(screen.getByText('변경 이력이 없습니다')).toBeInTheDocument()
      })
    })
  })

  describe('필드명 한글 변환', () => {
    it('name을 자산명으로 변환한다', async () => {
      render(<AssetHistory history={[mockHistoryUpdated]} />)

      await waitFor(() => {
        expect(screen.getByText('자산명')).toBeInTheDocument()
      })
    })

    it('ip_address를 IP 주소로 변환한다', async () => {
      const historyIp: AssetHistoryType = {
        id: 10,
        assetId: 1,
        changeType: 'updated',
        fieldName: 'ip_address',
        oldValue: '192.168.1.1',
        newValue: '192.168.1.2',
        changerName: '테스트',
        changedAt: '2024-01-24T12:00:00Z',
      }
      render(<AssetHistory history={[historyIp]} />)

      await waitFor(() => {
        expect(screen.getByText('IP 주소')).toBeInTheDocument()
      })
    })

    it('hostname을 호스트명으로 변환한다', async () => {
      const historyHostname: AssetHistoryType = {
        id: 11,
        assetId: 1,
        changeType: 'updated',
        fieldName: 'hostname',
        oldValue: 'old-host',
        newValue: 'new-host',
        changerName: '테스트',
        changedAt: '2024-01-25T12:00:00Z',
      }
      render(<AssetHistory history={[historyHostname]} />)

      await waitFor(() => {
        expect(screen.getByText('호스트명')).toBeInTheDocument()
      })
    })

    it('알 수 없는 필드명은 그대로 표시한다', async () => {
      const historyUnknown: AssetHistoryType = {
        id: 12,
        assetId: 1,
        changeType: 'updated',
        fieldName: 'unknown_field',
        oldValue: 'old',
        newValue: 'new',
        changerName: '테스트',
        changedAt: '2024-01-26T12:00:00Z',
      }
      render(<AssetHistory history={[historyUnknown]} />)

      await waitFor(() => {
        expect(screen.getByText('unknown_field')).toBeInTheDocument()
      })
    })
  })

  describe('값 표시 엣지 케이스', () => {
    it('oldValue가 없을 때 화살표 없이 newValue만 표시한다', async () => {
      render(<AssetHistory history={[mockHistoryNoOldValue]} />)

      await waitFor(() => {
        expect(screen.getByText('새 설명 추가')).toBeInTheDocument()
        // 화살표가 없어야 함
        expect(screen.queryByText('→')).not.toBeInTheDocument()
      })
    })

    it('newValue가 없을 때 (없음)을 표시한다', async () => {
      render(<AssetHistory history={[mockHistoryNoNewValue]} />)

      await waitFor(() => {
        expect(screen.getByText('(없음)')).toBeInTheDocument()
      })
    })
  })

  describe('여러 이력 항목 렌더링', () => {
    it('모든 이력 항목을 렌더링한다', async () => {
      render(<AssetHistory history={allMockHistory} />)

      await waitFor(() => {
        // 각 이력의 변경자명 확인
        expect(screen.getByText('변경자: 김등록')).toBeInTheDocument()
        expect(screen.getByText('변경자: 이수정')).toBeInTheDocument()
        expect(screen.getByText('변경자: 박운영')).toBeInTheDocument()
        expect(screen.getByText('변경자: 최평가')).toBeInTheDocument()
        expect(screen.getByText('변경자: 정관리')).toBeInTheDocument()
        expect(screen.getByText('변경자: 한폐기')).toBeInTheDocument()
      })
    })
  })
})
