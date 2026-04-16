/**
 * Drag & Drop 정렬 가능한 antd Table 래퍼
 * @dnd-kit 기반
 */
import React, { createContext, useContext, useMemo, useState } from 'react'
import { Table, Tag } from 'antd'
import { HolderOutlined } from '@ant-design/icons'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers'
import type { TableProps } from 'antd'

/** 드래그 핸들 — 이 컴포넌트를 컬럼 render에서 사용 */
const DragHandleContext = createContext<{
  listeners?: Record<string, Function>
  attributes?: Record<string, any>
}>({})

export const DragHandle: React.FC = () => {
  const { listeners, attributes } = useContext(DragHandleContext)
  return (
    <HolderOutlined
      style={{ cursor: 'grab', color: '#999', fontSize: 16, touchAction: 'none' }}
      {...attributes}
      {...listeners}
    />
  )
}

interface SortableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': string
}

const SortableRow: React.FC<SortableRowProps> = (props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props['data-row-key'] })

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.4, background: '#e6f4ff' } : {}),
  }

  const contextValue = useMemo(() => ({ listeners, attributes }), [listeners, attributes])

  return (
    <DragHandleContext.Provider value={contextValue}>
      <tr {...props} ref={setNodeRef} style={style} />
    </DragHandleContext.Provider>
  )
}

export interface SortableTableProps<T> extends Omit<TableProps<T>, 'components'> {
  onSortEnd: (activeId: string | number, overId: string | number) => void
}

function SortableTable<T extends { id: number }>({
  onSortEnd,
  columns,
  dataSource,
  ...rest
}: SortableTableProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (over && active.id !== over.id) {
      onSortEnd(active.id, over.id)
    }
  }

  // 드래그 핸들 컬럼을 맨 앞에 추가
  const dragColumn = {
    key: 'drag-handle',
    width: 40,
    align: 'center' as const,
    render: () => <DragHandle />,
  }

  const allColumns = [dragColumn, ...(columns || [])]

  const ids = (dataSource || []).map((item) => String(item.id))

  // 드래그 중인 아이템 찾기
  const activeItem = activeId ? (dataSource || []).find(item => String(item.id) === activeId) : null

  // 오버레이에 표시할 내용 (첫 번째 텍스트 컬럼 사용)
  const getOverlayLabel = (item: T): string => {
    if (!columns || columns.length === 0) return String((item as any).id)
    for (const col of columns) {
      const key = (col as any).dataIndex
      if (key && (item as any)[key] && typeof (item as any)[key] === 'string') {
        return (item as any)[key]
      }
    }
    return String((item as any).id)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <Table<T>
          {...rest}
          columns={allColumns}
          dataSource={dataSource}
          components={{
            body: {
              row: SortableRow,
            },
          }}
        />
      </SortableContext>
      <DragOverlay>
        {activeItem ? (
          <div
            style={{
              padding: '8px 16px',
              background: '#fff',
              border: '1px solid #1677ff',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
            }}
          >
            <HolderOutlined style={{ color: '#1677ff' }} />
            <span style={{ fontWeight: 500 }}>{getOverlayLabel(activeItem)}</span>
            <Tag color="blue" style={{ marginLeft: 'auto' }}>이동 중</Tag>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export default SortableTable
