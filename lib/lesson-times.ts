/** 8:00〜22:00 を30分刻み（HTML の value は HH:mm） */
export function buildLessonHalfHourTimes(startHour = 8, endHour = 22): string[] {
  const out: string[] = [];
  const startMin = startHour * 60;
  const endMin = endHour * 60;
  for (let m = startMin; m <= endMin; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return out;
}

export const lessonHalfHourTimeOptions = buildLessonHalfHourTimes();

/** DB にだけ存在する時刻（例: 旧データ）も選択肢に含める */
export function lessonTimeSelectOptions(existing?: string | null): string[] {
  const slot = existing?.trim().slice(0, 5) ?? "";
  if (!slot || lessonHalfHourTimeOptions.includes(slot)) {
    return lessonHalfHourTimeOptions;
  }
  return [slot, ...lessonHalfHourTimeOptions];
}

/** 受講登録など「開始時間」のプルダウン（30分刻み） */
export const lessonStartTimeOptions = lessonHalfHourTimeOptions;

/** 終了時間も同一グリッドから選択 */
export const lessonEndTimeOptions = lessonHalfHourTimeOptions;
