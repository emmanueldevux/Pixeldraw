// ============================================================
// UXLLY — Content Calendar Page
// Visual month calendar with posts
// ============================================================

"use client";

import { useState } from "react";
import DashboardHeader from "@/components/layout/DashboardHeader";
import Button from "@/components/ui/Button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isToday, addMonths, subMonths,
} from "date-fns";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <>
      <DashboardHeader
        title="Calendar"
        subtitle={format(currentMonth, "MMMM yyyy")}
        onMenuClick={() => {}}
        actions={
          <Button variant="primary" size="sm" icon={<Plus size={14} />}>
            Schedule Post
          </Button>
        }
      />

      <div className="uxlly-content">
        {/* ==================== Month Navigation ==================== */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 rounded-lg hover:bg-surface-100 text-ink-500"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold text-ink-900">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 rounded-lg hover:bg-surface-100 text-ink-500"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* ==================== Calendar Grid ==================== */}
        <div className="uxlly-calendar-grid">
          {/* Header */}
          {WEEKDAYS.map((day) => (
            <div key={day} className="uxlly-calendar-header-cell">{day}</div>
          ))}

          {/* Day cells */}
          {days.map((day) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`uxlly-calendar-day ${
                  isTodayDate ? "uxlly-calendar-day-today" : ""
                } ${!isCurrentMonth ? "uxlly-calendar-day-other" : ""}`}
              >
                <span className="uxlly-calendar-day-number">
                  {format(day, "d")}
                </span>
                {/* Posts will render here from DB */}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
