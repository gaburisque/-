"use client";

import { useTransition } from "react";
import { GraduationCap } from "lucide-react";

import { bulkPromoteGrades } from "@/app/actions";
import { Button } from "@/components/ui/button";

interface Props {
  /** 進級対象の人数 */
  promotingCount: number;
  /** 高3 → 卒業扱い（grade = null）になる人数 */
  graduatingCount: number;
}

export function GradePromotionButton({ promotingCount, graduatingCount }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const lines = [
      `active な生徒 ${promotingCount} 人を一括で +1 学年します。`,
      graduatingCount > 0
        ? `（高3の ${graduatingCount} 人は学年なし・年齢表示に切り替わります）`
        : null,
      "",
      "この操作は取り消せません。進級しますか？"
    ]
      .filter((l) => l !== null)
      .join("\n");

    if (!confirm(lines)) return;

    startTransition(async () => {
      await bulkPromoteGrades();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending || promotingCount === 0}
      className="gap-1.5"
    >
      <GraduationCap className="h-4 w-4" />
      {isPending ? "処理中..." : `4月進級（${promotingCount}人）`}
    </Button>
  );
}
