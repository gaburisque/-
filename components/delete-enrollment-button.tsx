"use client";

import { Trash2 } from "lucide-react";

import { deleteEnrollment } from "@/app/actions";
import { Button } from "@/components/ui/button";

interface Props {
  enrollmentId: string;
  studentId: string;
  courseName: string;
}

export function DeleteEnrollmentButton({ enrollmentId, studentId, courseName }: Props) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm(`「${courseName}」の受講登録を削除しますか？\n授業記録は残ります。この操作は取り消せません。`)) {
      e.preventDefault();
    }
  }

  return (
    <form action={deleteEnrollment} onSubmit={handleSubmit}>
      <input type="hidden" name="enrollment_id" value={enrollmentId} />
      <input type="hidden" name="student_id" value={studentId} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
        title="受講登録を削除"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </form>
  );
}
