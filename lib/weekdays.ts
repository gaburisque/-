export const weekdayOptions = ["月", "火", "水", "木", "金", "土", "日"];

export function currentJapaneseWeekday() {
  const weekday = new Intl.DateTimeFormat("ja-JP", {
    weekday: "short",
    timeZone: "Asia/Tokyo"
  }).format(new Date());

  return weekday.replace("曜", "");
}

export function parseWeekday(value: string | undefined): string {
  return value && weekdayOptions.includes(value) ? value : currentJapaneseWeekday();
}

function todayIsoInTokyo(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

/** クエリの date（空文字・配列・不正値）を YYYY-MM-DD に正規化。無効なら今日（東京） */
export function resolveIsoDateParam(
  value: string | string[] | undefined | null,
  fallback?: string
): string {
  const fallbackDate = fallback ?? todayIsoInTokyo();
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return fallbackDate;

  const parsed = new Date(`${trimmed}T12:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) return fallbackDate;

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(parsed);
}

export function weekdayFromDate(value: string | null | undefined) {
  const iso = resolveIsoDateParam(value, "");
  if (!iso) return null;

  const date = new Date(`${iso}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return null;

  const weekday = new Intl.DateTimeFormat("ja-JP", {
    weekday: "short",
    timeZone: "Asia/Tokyo"
  }).format(date);

  return weekday.replace("曜", "");
}

/** 東京暦で ±deltaDays した日付 (YYYY-MM-DD)。一覧・入力の曜日と整合するため正午 JST を基準にする */
export function addCalendarDaysInTokyo(isoDate: string, deltaDays: number): string {
  const base = new Date(`${isoDate}T12:00:00+09:00`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setTime(base.getTime() + deltaDays * 86400000);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(base);
}

/** 指定曜日になるまで ±3 日以内で最も近い日付（曜日タブ用） */
export function shiftDateToNearestWeekday(isoDate: string, targetWeekday: string): string {
  if (!weekdayOptions.includes(targetWeekday)) return isoDate;
  let bestDate = isoDate;
  let bestAbs = 999;
  for (let delta = -3; delta <= 3; delta++) {
    const candidate = addCalendarDaysInTokyo(isoDate, delta);
    if (weekdayFromDate(candidate) === targetWeekday) {
      const abs = Math.abs(delta);
      if (abs < bestAbs) {
        bestAbs = abs;
        bestDate = candidate;
      }
    }
  }
  return bestDate;
}
