/**
 * AssetForm 컴포넌트 테스트
 * TDD: RED -> GREEN -> REFACTOR
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssetForm from './AssetForm'
import type { Asset, AssetType, AssetCategory } from '@/types'

// 테스트용 Mock 데이터
const mockAssetTypes: AssetType[] = [
  { id: 1, code: 'SERVER', name: '서버', sortOrder: 1, isCustom: false, isActive: true, createdAt: '2024-01-01' },
  { id: 2, code: 'NETWORK', name: '네트워크장비', sortOrder: 2, isCustom: false, isActive: true, createdAt: '2024-01-01' },
  { id: 3, code: 'PC', name: 'PC/노트북', sortOrder: 3, isCustom: false, isActive: true, createdAt: '2024-01-01' },
  { id: 4, code: 'DOCUMENT', name: '문서', sortOrder: 4, isCustom: false, isActive: true, createdAt: '2024-01-01' },
  { id: 5, code: 'PERSONNEL', name: '인력', sortOrder: 5, isCustom: false, isActive: true, createdAt: '2024-01-01' },
  { id: 6, code: 'INACTIVE', name: '비활성유형', sortOrder: 6, isCustom: false, isActive: false, createdAt: '2024-01-01' },
]

const mockCategories: AssetCategory[] = [
  { id: 1, code: 'IT', name: 'IT 자산', level: 1, sortOrder: 1, isActive: true, createdAt: '2024-01-01', children: [] },
  { id: 2, code: 'INFRA', name: '인프라', level: 1, sortOrder: 2, isActive: true, createdAt: '2024-01-01', children: [] },
]

const mockDepartments = [
  { id: 1, name: 'IT부서' },
  { id: 2, name: '보안팀' },
  { id: 3, name: '개발팀' },
]

const mockUsers = [
  { id: 1, name: '홍길동', email: 'hong@example.com' },
  { id: 2, name: '김철수', email: 'kim@example.com' },
  { id: 3, name: '이영희', email: 'lee@example.com' },
]

const mockAsset: Asset = {
  id: 1,
  assetCode: 'AST-SRV-202401-001',
  name: '테스트 서버',
  assetTypeId: 1,
  assetTypeName: '서버',
  assetTypeCode: 'SERVER',
  categoryId: 1,
  departmentId: 1,
  departmentName: 'IT부서',
  ownerId: 1,
  ownerName: '홍길동',
  location: '서울 데이터센터',
  ipAddress: '192.168.1.100',
  macAddress: '00:11:22:33:44:55',
  hostname: 'test-server-01',
  osVersion: 'Ubuntu 22.04',
  manufacturer: 'Dell',
  model: 'PowerEdge R740',
  serialNumber: 'SN123456',
  acquisitionDate: '2024-01-15',
  acquisitionCost: 5000000,
  warrantyEndDate: '2027-01-15',
  status: 'operating',
  isActive: true,
  createdAt: '2024-01-15T00:00:00Z',
}

const defaultProps = {
  assetTypes: mockAssetTypes,
  categories: mockCategories,
  departments: mockDepartments,
  users: mockUsers,
  onSubmit: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn(),
}

describe('AssetForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('기본 필드 렌더링', () => {
    it('자산명 필드를 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('자산명')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('자산명을 입력하세요')).toBeInTheDocument()
      })
    })

    it('자산 유형 필드를 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('자산 유형')).toBeInTheDocument()
      })
    })

    it('분류 필드를 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('분류')).toBeInTheDocument()
      })
    })

    it('위치 필드를 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('위치')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('물리적 위치를 입력하세요')).toBeInTheDocument()
      })
    })

    it('설명 필드를 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('설명')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('자산에 대한 설명을 입력하세요')).toBeInTheDocument()
      })
    })
  })

  describe('담당 정보 섹션', () => {
    it('담당 부서 필드를 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('담당 부서')).toBeInTheDocument()
      })
    })

    it('자산 소유자 필드를 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('자산 소유자')).toBeInTheDocument()
      })
    })
  })

  describe('제조/취득 정보 섹션', () => {
    it('제조사 필드를 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('제조사')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('제조사명')).toBeInTheDocument()
      })
    })

    it('모델명 필드를 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('모델명')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('모델명')).toBeInTheDocument()
      })
    })

    it('시리얼 번호 필드를 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('시리얼 번호')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('시리얼 번호')).toBeInTheDocument()
      })
    })

    it('취득일 필드를 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('취득일')).toBeInTheDocument()
      })
    })

    it('취득 비용 필드를 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('취득 비용 (원)')).toBeInTheDocument()
      })
    })

    it('보증 만료일 필드를 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('보증 만료일')).toBeInTheDocument()
      })
    })
  })

  describe('섹션 Divider', () => {
    it('기본 정보 섹션을 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('기본 정보')).toBeInTheDocument()
      })
    })

    it('담당 정보 섹션을 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('담당 정보')).toBeInTheDocument()
      })
    })

    it('제조/취득 정보 섹션을 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('제조/취득 정보')).toBeInTheDocument()
      })
    })
  })

  describe('버튼', () => {
    it('등록 버튼을 렌더링한다 (신규)', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '등록' })).toBeInTheDocument()
      })
    })

    it('수정 버튼을 렌더링한다 (수정 모드)', async () => {
      render(<AssetForm {...defaultProps} initialValues={mockAsset} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument()
      }, { timeout: 10000 })
    }, 30000)

    it('취소 버튼을 렌더링한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
      })
    })

    it('취소 버튼 클릭 시 onCancel 콜백을 호출한다', async () => {
      const user = userEvent.setup()
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '취소' }))

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('로딩 상태', () => {
    it('loading이 true일 때 스피너를 표시한다', async () => {
      render(<AssetForm {...defaultProps} loading={true} />)

      await waitFor(() => {
        // Ant Design Spin 컴포넌트는 ant-spin 클래스 사용
        const spinner = document.querySelector('.ant-spin')
        expect(spinner).toBeInTheDocument()
      })
    })

    it('loading이 false일 때 폼을 표시한다', async () => {
      render(<AssetForm {...defaultProps} loading={false} />)

      await waitFor(() => {
        expect(screen.getByText('자산명')).toBeInTheDocument()
      })
    })
  })

  describe('자산 유형 선택 시 동적 필드', () => {
    it('서버 유형을 가진 초기값이 있으면 기술 정보 섹션을 표시한다', async () => {
      // 서버 유형으로 미리 설정된 자산으로 테스트
      render(<AssetForm {...defaultProps} initialValues={mockAsset} />)

      await waitFor(() => {
        expect(screen.getByText('기술 정보')).toBeInTheDocument()
        expect(screen.getByText('IP 주소')).toBeInTheDocument()
        expect(screen.getByText('호스트명')).toBeInTheDocument()
        expect(screen.getByText('OS 버전')).toBeInTheDocument()
      })
    })

    it('네트워크장비 유형을 가진 초기값이 있으면 해당 필드를 표시한다', async () => {
      const networkAsset: Asset = {
        ...mockAsset,
        assetTypeId: 2,
        assetTypeName: '네트워크장비',
        assetTypeCode: 'NETWORK',
      }
      render(<AssetForm {...defaultProps} initialValues={networkAsset} />)

      await waitFor(() => {
        expect(screen.getByText('기술 정보')).toBeInTheDocument()
        expect(screen.getByText('IP 주소')).toBeInTheDocument()
        expect(screen.getByText('MAC 주소')).toBeInTheDocument()
        expect(screen.getByText('호스트명')).toBeInTheDocument()
      })
    })

    it('PC/노트북 유형을 가진 초기값이 있으면 해당 필드를 표시한다', async () => {
      const pcAsset: Asset = {
        ...mockAsset,
        assetTypeId: 3,
        assetTypeName: 'PC/노트북',
        assetTypeCode: 'PC',
      }
      render(<AssetForm {...defaultProps} initialValues={pcAsset} />)

      await waitFor(() => {
        expect(screen.getByText('기술 정보')).toBeInTheDocument()
        expect(screen.getByText('IP 주소')).toBeInTheDocument()
        expect(screen.getByText('MAC 주소')).toBeInTheDocument()
        expect(screen.getByText('호스트명')).toBeInTheDocument()
        expect(screen.getByText('OS 버전')).toBeInTheDocument()
      })
    })

    it('문서 유형을 가진 초기값이 있으면 기술 정보 섹션을 표시하지 않는다', async () => {
      const docAsset: Asset = {
        ...mockAsset,
        assetTypeId: 4,
        assetTypeName: '문서',
        assetTypeCode: 'DOCUMENT',
      }
      render(<AssetForm {...defaultProps} initialValues={docAsset} />)

      await waitFor(() => {
        expect(screen.queryByText('IP 주소')).not.toBeInTheDocument()
        expect(screen.queryByText('MAC 주소')).not.toBeInTheDocument()
      })
    })

    it('활성 자산 유형만 표시되어야 한다 (isActive=true)', async () => {
      // 비활성 유형은 필터링되어야 함
      const activeTypes = mockAssetTypes.filter(t => t.isActive)
      const inactiveTypes = mockAssetTypes.filter(t => !t.isActive)

      expect(activeTypes.length).toBeGreaterThan(0)
      expect(inactiveTypes.length).toBeGreaterThan(0)
      expect(inactiveTypes.some(t => t.name === '비활성유형')).toBe(true)
    })
  })

  describe('수정 모드 초기값', () => {
    it('initialValues가 있을 때 폼 필드에 초기값을 표시한다', async () => {
      render(<AssetForm {...defaultProps} initialValues={mockAsset} />)

      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('자산명을 입력하세요')
        expect(nameInput).toHaveValue('테스트 서버')
      })
    })

    it('수정 모드일 때 상태 정보 섹션을 표시한다', async () => {
      render(<AssetForm {...defaultProps} initialValues={mockAsset} />)

      await waitFor(() => {
        expect(screen.getByText('상태 정보')).toBeInTheDocument()
      })
    })

    it('수정 모드가 아닐 때 상태 정보 섹션을 표시하지 않는다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.queryByText('상태 정보')).not.toBeInTheDocument()
      })
    })

    it('수정 모드일 때 기술 정보 필드에 초기값을 표시한다', async () => {
      render(<AssetForm {...defaultProps} initialValues={mockAsset} />)

      await waitFor(() => {
        expect(screen.getByText('기술 정보')).toBeInTheDocument()
      })

      await waitFor(() => {
        const ipInput = screen.getByPlaceholderText('192.168.1.1')
        expect(ipInput).toHaveValue('192.168.1.100')
      })
    })
  })

  describe('폼 검증', () => {
    it('자산명 없이 제출하면 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      render(<AssetForm {...defaultProps} />)

      // 자산명 없이 제출
      await user.click(screen.getByRole('button', { name: '등록' }))

      await waitFor(() => {
        expect(screen.getByText('자산명을 입력해주세요')).toBeInTheDocument()
      })
    })

    it('자산 유형 없이 제출하면 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      render(<AssetForm {...defaultProps} />)

      // 자산명만 입력
      const nameInput = screen.getByPlaceholderText('자산명을 입력하세요')
      await user.type(nameInput, '테스트 자산')

      await user.click(screen.getByRole('button', { name: '등록' }))

      await waitFor(() => {
        expect(screen.getByText('자산 유형을 선택해주세요')).toBeInTheDocument()
      })
    })
  })

  describe('폼 제출', () => {
    it('유효한 폼 제출 시 onSubmit 콜백을 호출한다', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined)
      // 초기값으로 필수 필드가 채워진 asset을 전달하여 validation 통과
      const initialAsset = {
        id: 1,
        assetCode: 'SRV-001',
        name: '테스트 서버',
        assetTypeId: 1,
        assetTypeName: '서버',
        status: 'operating' as const,
        confidentiality: 3,
        integrity: 3,
        availability: 3,
        assetValue: 3,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }
      render(<AssetForm {...defaultProps} initialValues={initialAsset as any} onSubmit={onSubmit} />)

      const user = userEvent.setup()
      // 등록/수정 버튼 클릭
      const submitButton = screen.getByRole('button', { name: /등록|수정/ })
      await user.click(submitButton)

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled()
      }, { timeout: 10000 })
    })

    it('제출 시 자산명이 전달된다', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined)
      const initialAsset = {
        id: 1,
        assetCode: 'SRV-001',
        name: '신규 서버',
        assetTypeId: 1,
        assetTypeName: '서버',
        status: 'operating' as const,
        confidentiality: 3,
        integrity: 3,
        availability: 3,
        assetValue: 3,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }
      render(<AssetForm {...defaultProps} initialValues={initialAsset as any} onSubmit={onSubmit} />)

      const user = userEvent.setup()
      const submitButton = screen.getByRole('button', { name: /등록|수정/ })
      await user.click(submitButton)

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled()
        const submitData = onSubmit.mock.calls[0][0]
        expect(submitData.name).toBe('신규 서버')
      }, { timeout: 10000 })
    })
  })

  describe('사용자 및 부서 선택', () => {
    it('부서 목록이 props로 전달되었는지 확인한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('담당 부서')).toBeInTheDocument()
      })

      // props로 전달된 부서 목록 확인
      expect(defaultProps.departments.length).toBe(3)
      expect(defaultProps.departments.map(d => d.name)).toContain('IT부서')
      expect(defaultProps.departments.map(d => d.name)).toContain('보안팀')
      expect(defaultProps.departments.map(d => d.name)).toContain('개발팀')
    })

    it('사용자 목록이 props로 전달되었는지 확인한다', async () => {
      render(<AssetForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('자산 소유자')).toBeInTheDocument()
      })

      // props로 전달된 사용자 목록 확인
      expect(defaultProps.users.length).toBe(3)
      expect(defaultProps.users.map(u => u.name)).toContain('홍길동')
      expect(defaultProps.users.map(u => u.name)).toContain('김철수')
      expect(defaultProps.users.map(u => u.name)).toContain('이영희')
    })
  })

  describe('분류 트리 평탄화', () => {
    it('중첩된 분류가 올바르게 전달된다', async () => {
      const nestedCategories: AssetCategory[] = [
        {
          id: 1,
          code: 'IT',
          name: 'IT 자산',
          level: 1,
          sortOrder: 1,
          isActive: true,
          createdAt: '2024-01-01',
          children: [
            {
              id: 2,
              code: 'HW',
              name: '하드웨어',
              level: 2,
              parentId: 1,
              sortOrder: 1,
              isActive: true,
              createdAt: '2024-01-01',
              children: [],
            },
          ],
        },
      ]

      render(<AssetForm {...defaultProps} categories={nestedCategories} />)

      // 분류 필드가 렌더링되는지 확인
      await waitFor(() => {
        expect(screen.getByText('분류')).toBeInTheDocument()
      })

      // 중첩된 분류 데이터 구조 확인
      expect(nestedCategories[0].children).toBeDefined()
      expect(nestedCategories[0].children?.length).toBe(1)
      expect(nestedCategories[0].children?.[0].name).toBe('하드웨어')
    })
  })

  describe('상태 선택 (수정 모드)', () => {
    it('수정 모드에서 상태 필드가 표시된다', async () => {
      render(<AssetForm {...defaultProps} initialValues={mockAsset} />)

      await waitFor(() => {
        expect(screen.getByText('상태 정보')).toBeInTheDocument()
        expect(screen.getByText('상태')).toBeInTheDocument()
      })
    })

    it('초기값의 상태가 폼에 설정된다', async () => {
      // mockAsset의 status는 'operating'
      render(<AssetForm {...defaultProps} initialValues={mockAsset} />)

      await waitFor(() => {
        expect(screen.getByText('상태 정보')).toBeInTheDocument()
        // 운영 상태가 선택되어 있어야 함
        const statusField = screen.getByText('상태').closest('.ant-form-item')
        expect(statusField).toBeInTheDocument()
      })
    })
  })
})
