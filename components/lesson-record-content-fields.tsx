import { ChevronDown } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LessonRecordContentFields } from "@/lib/lesson-record-content";

export type LessonRecordFormDefaults = Partial<
  LessonRecordContentFields & { next_plan?: string; remarks?: string }
>;

export function LessonRecordFormFields({ defaults }: { defaults?: LessonRecordFormDefaults }) {
  const d = defaults ?? {};
  const hasOptional = Boolean(d.typing_tool || d.typing_note || d.remarks);

  return (
    <div className="space-y-5 md:col-span-2">
      <div className="space-y-1.5">
        <Label htmlFor="goal" className="text-sm font-medium">
          今日の目的
        </Label>
        <Input
          id="goal"
          name="goal"
          defaultValue={d.goal ?? ""}
          placeholder="例: 変数ブロックを使ったスコア実装"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lesson_tool" className="text-sm font-medium">
          レッスン使用ツール
        </Label>
        <Input
          id="lesson_tool"
          name="lesson_tool"
          defaultValue={d.lesson_tool ?? ""}
          placeholder="例: Scratch 3.0"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lesson_note" className="text-sm font-medium">
          授業の様子
        </Label>
        <Textarea
          id="lesson_note"
          name="lesson_note"
          defaultValue={d.lesson_note ?? ""}
          className="min-h-[200px] resize-y leading-7"
          placeholder="取り組み・理解度・つまずき・集中度・会話の内容など、詳しく記録"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="excitement_note" className="text-sm font-medium">
          子どもの反応・ワクワクの様子
        </Label>
        <Textarea
          id="excitement_note"
          name="excitement_note"
          defaultValue={d.excitement_note ?? ""}
          className="min-h-[96px] resize-y"
          placeholder="楽しんでいた点・印象的だった反応など"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="next_plan" className="text-sm font-medium">
          次回の予定・宿題
        </Label>
        <Textarea
          id="next_plan"
          name="next_plan"
          defaultValue={d.next_plan ?? ""}
          className="min-h-[80px] resize-y"
          placeholder="次回やること・持ち物など"
        />
      </div>

      <details
        className="group rounded-md border border-border bg-card"
        open={hasOptional}
      >
        <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          その他の項目
          <span className="text-xs font-normal text-muted-foreground/70">
            （タイピング・備考）
          </span>
        </summary>
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="typing_tool">タイピング使用ツール</Label>
            <Input
              id="typing_tool"
              name="typing_tool"
              defaultValue={d.typing_tool ?? ""}
              placeholder="例: Typing.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="typing_note">タイピングの様子</Label>
            <Textarea
              id="typing_note"
              name="typing_note"
              defaultValue={d.typing_note ?? ""}
              className="min-h-[72px] resize-y"
              placeholder="スピード・正確さ・集中度など"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="remarks">備考・保護者へのメモ</Label>
            <Textarea
              id="remarks"
              name="remarks"
              defaultValue={d.remarks ?? ""}
              className="min-h-[64px] resize-y"
              placeholder="保護者へ伝えたいこと・連絡事項など"
            />
          </div>
        </div>
      </details>
    </div>
  );
}
