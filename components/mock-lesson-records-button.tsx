"use client";

import { useTransition } from "react";
import { Database } from "lucide-react";

import { createMockLessonRecords } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function MockLessonRecordsButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("画面確認用の仮生徒・受講登録・授業記録を追加しますか？")) {
      return;
    }

    startTransition(async () => {
      await createMockLessonRecords();
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
      <Database className="h-4 w-4" />
      {isPending ? "追加中..." : "仮データ追加"}
    </Button>
  );
}
