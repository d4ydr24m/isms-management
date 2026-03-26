import { Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useState, useEffect, useCallback, useRef } from 'react'

interface SearchInputProps {
  placeholder?: string
  onSearch: (value: string) => void
  debounceMs?: number
  allowClear?: boolean
  width?: number
  disabled?: boolean
  value?: string
}

const SearchInput = ({
  placeholder = '검색...',
  onSearch,
  debounceMs = 500,
  allowClear = true,
  width = 300,
  disabled = false,
  value: controlledValue,
}: SearchInputProps) => {
  const [internalValue, setInternalValue] = useState(controlledValue || '')

  // Update internal value when controlled value changes
  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue)
    }
  }, [controlledValue])

  // Store latest onSearch in ref to avoid triggering effect on every render
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch

  // Track if user has interacted (skip initial debounce)
  const hasInteracted = useRef(false)

  // Debounced search
  useEffect(() => {
    if (controlledValue !== undefined) return // Skip debounce for controlled component
    if (!hasInteracted.current) return // Skip initial mount

    const handler = setTimeout(() => {
      onSearchRef.current(internalValue)
    }, debounceMs)

    return () => {
      clearTimeout(handler)
    }
  }, [internalValue, debounceMs, controlledValue])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      hasInteracted.current = true
      const newValue = e.target.value
      setInternalValue(newValue)

      // If controlled, call onSearch immediately
      if (controlledValue !== undefined) {
        onSearch(newValue)
      }
    },
    [controlledValue, onSearch]
  )

  const handlePressEnter = useCallback(() => {
    onSearch(internalValue)
  }, [internalValue, onSearch])

  const handleClear = useCallback(() => {
    setInternalValue('')
    onSearch('')
  }, [onSearch])

  return (
    <div style={{ width: `${width}px` }}>
      <Input
        prefix={<SearchOutlined />}
        placeholder={placeholder}
        value={controlledValue !== undefined ? controlledValue : internalValue}
        onChange={handleChange}
        onPressEnter={handlePressEnter}
        allowClear={allowClear}
        disabled={disabled}
        {...(allowClear && { onClear: handleClear })}
      />
    </div>
  )
}

export default SearchInput
