"use client";

import { Copy } from "lucide-react";

interface CopyPrevRecordButtonProps {
  title?: string | null;
  content?: string | null;
  homework?: string | null;
  memo?: string | null;
}

export function CopyPrevRecordButton({ title, content, homework, memo }: CopyPrevRecordButtonProps) {
  function handleCopy() {
    const form = document.querySelector<HTMLFormElement>("form[data-lesson-record-form]");
    if (!form) return;

    const setField = (name: string, value: string | null | undefined) => {
      if (value == null) return;
      const el = form.elements.namedItem(name);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };

    setField("goal", title);
    setField("content", content);
    setField("next_plan", homework);
    setField("remarks", memo);

    const details = document.querySelector<HTMLDetailsElement>("details[data-prev-record]");
    if (details) details.open = false;
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Copy className="h-3 w-3" />
      この内容をコピー
    </button>
  );
}
