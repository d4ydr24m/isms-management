import { Table } from 'antd'
import type { TableProps } from 'antd'

interface DataTableProps<T> extends TableProps<T> {
  className?: string
}

function DataTable<T extends Record<string, any>>({
  className,
  ...props
}: DataTableProps<T>) {
  return (
    <Table
      {...props}
      className={className}
      bordered
      locale={{
        emptyText: '데이터가 없습니다',
      }}
    />
  )
}

export default DataTable
