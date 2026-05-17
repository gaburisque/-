"use client";

import { Trash2 } from "lucide-react";

import { deleteLessonRecord } from "@/app/actions";
import { Button } from "@/components/ui/button";

interface Props {
  lessonRecordId: string;
  studentId?: string | null;
  redirectTo?: string;
  variant?: "destructive" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  label?: string;
}

export function DeleteLessonRecordButton({
  lessonRecordId,
  studentId,
  redirectTo,
  variant = "destructive",
  size = "sm",
  label = "削除"
}: Props) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm("この授業記録を削除しますか？\nこの操作は取り消せません。")) {
      e.preventDefault();
    }
  }

  return (
    <form action={deleteLessonRecord} onSubmit={handleSubmit}>
      <input type="hidden" name="lesson_record_id" value={lessonRecordId} />
      {studentId && <input type="hidden" name="student_id" value={studentId} />}
      {redirectTo && <input type="hidden" name="redirect_to" value={redirectTo} />}
      <Button type="submit" variant={variant} size={size} className="gap-1.5">
        <Trash2 className="h-3.5 w-3.5" />
        {label}
      </Button>
    </form>
  );
}
