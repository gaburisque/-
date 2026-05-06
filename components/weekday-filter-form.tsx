"use client";

import { Search } from "lucide-react";

import { NativeSelect } from "@/components/ui/native-select";
import { weekdayOptions } from "@/lib/weekdays";

export function WeekdayFilterForm({ weekday }: { weekday: string }) {
  return (
    <form className="grid gap-3 sm:grid-cols-[220px]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <NativeSelect
          name="weekday"
          defaultValue={weekday}
          className="pl-9"
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          {weekdayOptions.map((option) => (
            <option key={option} value={option}>
              {option}曜日
            </option>
          ))}
        </NativeSelect>
      </div>
    </form>
  );
}
