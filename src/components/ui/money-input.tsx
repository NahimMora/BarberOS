"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { formatMoneyDisplay, maskMoneyInput } from "@/lib/money/money"

type MoneyInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  /** Canonical decimal string, e.g. "1234.50". */
  value: string
  /** Receives the canonical decimal string on every change. */
  onValueChange: (value: string) => void
  allowNegative?: boolean
}

function MoneyInput({ value, onValueChange, allowNegative = false, ...props }: MoneyInputProps) {
  const [display, setDisplay] = React.useState(() => formatMoneyDisplay(value, allowNegative))
  const lastEmitted = React.useRef(value)

  React.useEffect(() => {
    if (value !== lastEmitted.current) {
      setDisplay(formatMoneyDisplay(value, allowNegative))
      lastEmitted.current = value
    }
  }, [value, allowNegative])

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target
    const cursor = input.selectionStart ?? input.value.length
    const result = maskMoneyInput(input.value, cursor, allowNegative)
    setDisplay(result.display)
    lastEmitted.current = result.canonical
    onValueChange(result.canonical)
    requestAnimationFrame(() => {
      input.setSelectionRange(result.cursor, result.cursor)
    })
  }

  return (
    <Input
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      {...props}
    />
  )
}

export { MoneyInput }
