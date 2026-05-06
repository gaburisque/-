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

export function weekdayFromDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00+09:00`);
  const weekday = new Intl.DateTimeFormat("ja-JP", {
    weekday: "short",
    timeZone: "Asia/Tokyo"
  }).format(date);

  return weekday.replace("曜", "");
}
