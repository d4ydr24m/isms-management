import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DataTable from './DataTable'

interface TestData {
  id: number
  name: string
  status: string
  createdAt: string
}

const mockData: TestData[] = [
  { id: 1, name: 'Test 1', status: 'active', createdAt: '2024-01-01' },
  { id: 2, name: 'Test 2', status: 'inactive', createdAt: '2024-01-02' },
  { id: 3, name: 'Test 3', status: 'active', createdAt: '2024-01-03' },
]

const mockColumns = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
  },
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
  },
  {
    title: 'Created At',
    dataIndex: 'createdAt',
    key: 'createdAt',
  },
]

describe('DataTable', () => {
  it('should render table with data', () => {
    render(<DataTable columns={mockColumns} dataSource={mockData} rowKey="id" />)

    expect(screen.getByText('Test 1')).toBeInTheDocument()
    expect(screen.getByText('Test 2')).toBeInTheDocument()
    expect(screen.getByText('Test 3')).toBeInTheDocument()
  })

  it('should render table headers', () => {
    render(<DataTable columns={mockColumns} dataSource={mockData} rowKey="id" />)

    expect(screen.getByText('ID')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Created At')).toBeInTheDocument()
  })

  it('should display loading state', () => {
    const { container } = render(
      <DataTable columns={mockColumns} dataSource={[]} rowKey="id" loading={true} />
    )

    const spinner = container.querySelector('.ant-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('should handle pagination', async () => {
    const mockOnChange = vi.fn()
    const { container } = render(
      <DataTable
        columns={mockColumns}
        dataSource={mockData}
        rowKey="id"
        pagination={{
          current: 1,
          pageSize: 2,
          total: 3,
        }}
        onChange={mockOnChange}
      />
    )

    // Check if pagination is rendered
    const pagination = container.querySelector('.ant-pagination')
    expect(pagination).toBeInTheDocument()
  })

  it('should handle empty data', () => {
    render(<DataTable columns={mockColumns} dataSource={[]} rowKey="id" />)

    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('should support custom row selection', () => {
    const mockOnRowSelectionChange = vi.fn()
    render(
      <DataTable
        columns={mockColumns}
        dataSource={mockData}
        rowKey="id"
        rowSelection={{
          onChange: mockOnRowSelectionChange,
        }}
      />
    )

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)
  })

  it('should render with custom className', () => {
    const { container } = render(
      <DataTable
        columns={mockColumns}
        dataSource={mockData}
        rowKey="id"
        className="custom-table"
      />
    )

    const table = container.querySelector('.custom-table')
    expect(table).toBeInTheDocument()
  })

  it('should handle sorting', async () => {
    const mockOnChange = vi.fn()
    const sortableColumns = [
      {
        ...mockColumns[0],
        sorter: true,
      },
      ...mockColumns.slice(1),
    ]

    render(
      <DataTable
        columns={sortableColumns}
        dataSource={mockData}
        rowKey="id"
        onChange={mockOnChange}
      />
    )

    // Check if sorter icon is rendered
    const headers = screen.getAllByRole('columnheader')
    expect(headers.length).toBeGreaterThan(0)
  })

  it('should support scroll', () => {
    const { container } = render(
      <DataTable
        columns={mockColumns}
        dataSource={mockData}
        rowKey="id"
        scroll={{ x: 1000, y: 400 }}
      />
    )

    const table = container.querySelector('table')
    expect(table).toBeInTheDocument()
  })
})
