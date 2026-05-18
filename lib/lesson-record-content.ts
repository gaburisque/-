export const LESSON_CONTENT_LABELS = {
  goal: "今日の目的",
  typing_tool: "タイピング使用ツール",
  typing_note: "タイピングの様子",
  lesson_tool: "レッスン使用ツール",
  lesson_note: "レッスンの様子",
  excitement_note: "今日のワクワクの様子"
} as const;

export type LessonRecordContentFields = {
  goal: string;
  typing_tool: string;
  typing_note: string;
  lesson_tool: string;
  lesson_note: string;
  excitement_note: string;
};

const PARSE_LABEL_TO_FIELD: Record<string, keyof LessonRecordContentFields> = {
  [LESSON_CONTENT_LABELS.goal]: "goal",
  [LESSON_CONTENT_LABELS.typing_tool]: "typing_tool",
  [LESSON_CONTENT_LABELS.typing_note]: "typing_note",
  [LESSON_CONTENT_LABELS.lesson_tool]: "lesson_tool",
  [LESSON_CONTENT_LABELS.lesson_note]: "lesson_note",
  授業の様子: "lesson_note",
  [LESSON_CONTENT_LABELS.excitement_note]: "excitement_note",
  "子どもの反応・ワクワクの様子": "excitement_note"
};

const PARSE_LABELS = Object.keys(PARSE_LABEL_TO_FIELD);

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function structuredLessonContent(items: Array<[string, string | null]>) {
  return (
    items
      .filter(([, value]) => value && value.trim().length > 0)
      .map(([label, value]) => `${label}：${value}`)
      .join("\n\n") || null
  );
}

export function parseLessonRecordContent(
  content: string | null | undefined,
  title?: string | null
): LessonRecordContentFields {
  const fields: LessonRecordContentFields = {
    goal: "",
    typing_tool: "",
    typing_note: "",
    lesson_tool: "",
    lesson_note: "",
    excitement_note: ""
  };

  if (content?.trim()) {
    const labelsPattern = PARSE_LABELS.map(escapeRegex).join("|");
    const splitRegex = new RegExp(`(?=(?:${labelsPattern})：)`);
    const parts = content.split(splitRegex).filter(Boolean);

    for (const part of parts) {
      const colonIdx = part.indexOf("：");
      if (colonIdx === -1) continue;
      const label = part.slice(0, colonIdx).trim();
      const value = part.slice(colonIdx + 1).trim();
      const key = PARSE_LABEL_TO_FIELD[label];
      if (key && value) {
        fields[key] = fields[key] ? `${fields[key]}\n\n${value}` : value;
      }
    }
  }

  fields.goal = title?.trim() || fields.goal;
  return fields;
}

export function buildLessonRecordContent(fields: LessonRecordContentFields): string | null {
  return structuredLessonContent([
    [LESSON_CONTENT_LABELS.goal, fields.goal || null],
    [LESSON_CONTENT_LABELS.typing_tool, fields.typing_tool || null],
    [LESSON_CONTENT_LABELS.typing_note, fields.typing_note || null],
    [LESSON_CONTENT_LABELS.lesson_tool, fields.lesson_tool || null],
    [LESSON_CONTENT_LABELS.lesson_note, fields.lesson_note || null],
    [LESSON_CONTENT_LABELS.excitement_note, fields.excitement_note || null]
  ]);
}

export function lessonContentFieldsFromFormData(formData: FormData): LessonRecordContentFields {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  return {
    goal: text("goal"),
    typing_tool: text("typing_tool"),
    typing_note: text("typing_note"),
    lesson_tool: text("lesson_tool"),
    lesson_note: text("lesson_note"),
    excitement_note: text("excitement_note")
  };
}

/** 表示用ラベル（入力フォームの表記に合わせる） */
export function isStructuredLessonContent(content: string | null | undefined) {
  if (!content?.trim()) return false;
  const labelsPattern = PARSE_LABELS.map(escapeRegex).join("|");
  return new RegExp(`(?:${labelsPattern})：`).test(content);
}

export const LESSON_CONTENT_DISPLAY_LABELS: Record<keyof LessonRecordContentFields, string> = {
  goal: "今日の目的",
  typing_tool: "タイピング使用ツール",
  typing_note: "タイピングの様子",
  lesson_tool: "レッスン使用ツール",
  lesson_note: "授業の様子",
  excitement_note: "子どもの反応・ワクワクの様子"
};
