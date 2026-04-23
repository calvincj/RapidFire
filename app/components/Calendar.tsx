'use client'

import { useState, useEffect } from 'react'

interface Props {
  availableDates: string[]
  selectedDate: string
  todayDate: string
  onSelectDate: (date: string) => void
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function Calendar({ availableDates, selectedDate, todayDate, onSelectDate }: Props) {
  const [selY, selM] = selectedDate.split('-').map(Number)
  const [view, setView] = useState({ year: selY, month: selM })

  // Sync view when selectedDate changes externally
  useEffect(() => {
    const [y, m] = selectedDate.split('-').map(Number)
    setView({ year: y, month: m })
  }, [selectedDate])

  const available = new Set(availableDates)
  const daysInMonth = new Date(view.year, view.month, 0).getDate()
  const firstWeekday = new Date(view.year, view.month - 1, 1).getDay()

  const prevMonth = () =>
    setView(v => v.month === 1 ? { year: v.year - 1, month: 12 } : { ...v, month: v.month - 1 })
  const nextMonth = () =>
    setView(v => v.month === 12 ? { year: v.year + 1, month: 1 } : { ...v, month: v.month + 1 })

  const monthLabel = new Date(view.year, view.month - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="pt-2">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-opacity hover:opacity-60"
          style={{ color: 'var(--color-text-2)' }}
        >
          ‹
        </button>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          aria-label="Next month"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-opacity hover:opacity-60"
          style={{ color: 'var(--color-text-2)' }}
        >
          ›
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-xs font-medium py-1"
            style={{ color: 'var(--color-text-muted)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: firstWeekday }, (_, i) => <div key={`gap-${i}`} />)}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const dateStr = `${view.year}-${String(view.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const hasData = available.has(dateStr)
          const isSelected = dateStr === selectedDate
          const isToday = dateStr === todayDate

          return (
            <div key={day} className="flex justify-center">
              <button
                onClick={() => hasData && onSelectDate(dateStr)}
                disabled={!hasData}
                aria-label={dateStr}
                className="w-9 h-9 rounded-xl text-sm font-medium transition-opacity"
                style={
                  isSelected
                    ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }
                    : hasData
                    ? { color: 'var(--color-text)', outline: isToday ? '2px solid var(--color-ring)' : undefined, outlineOffset: isToday ? '1px' : undefined }
                    : { color: 'var(--color-text-muted)', cursor: 'default', opacity: 0.4 }
                }
              >
                {day}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
