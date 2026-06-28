"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "@untitled-ui/icons-react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type DatePickerProps = {
  /** Controlled selected date. */
  value?: Date
  /** Initial date for uncontrolled usage. */
  defaultValue?: Date
  onChange?: (date: Date | undefined) => void
  /** date-fns format string for the displayed value. */
  dateFormat?: string
  placeholder?: string
  disabled?: boolean
  className?: string
} & Omit<React.ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange" | "type">

function DatePicker({
  value,
  defaultValue,
  onChange,
  dateFormat = "PPP",
  placeholder = "Pick a date",
  disabled,
  className,
  ...inputProps
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState<Date | undefined>(defaultValue)
  const selected = isControlled ? value : internal

  const handleSelect = (date: Date | undefined) => {
    if (!isControlled) setInternal(date)
    onChange?.(date)
    if (date) setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div data-slot="date-picker" className={cn("relative", className)}>
          <Input
            readOnly
            disabled={disabled}
            value={selected ? format(selected, dateFormat) : ""}
            placeholder={placeholder}
            className="cursor-pointer pr-8"
            {...inputProps}
          />
          <CalendarIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={selected} onSelect={handleSelect} autoFocus />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
