import { Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useState, useEffect, useCallback } from 'react'

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
  placeholder = 'Search...',
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

  // Debounced search
  useEffect(() => {
    if (controlledValue !== undefined) return // Skip debounce for controlled component

    const handler = setTimeout(() => {
      onSearch(internalValue)
    }, debounceMs)

    return () => {
      clearTimeout(handler)
    }
  }, [internalValue, debounceMs, onSearch, controlledValue])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
