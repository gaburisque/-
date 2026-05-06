export function fullName(person: { last_name: string; first_name: string }) {
  return `${person.last_name} ${person.first_name}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function emptyText(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "-";
}

export function previewText(value: string | null | undefined, maxLength = 90) {
  const text = emptyText(value).replace(/\s+/g, " ");

  if (text === "-" || text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

export function formatTime(value: string | null | undefined) {
  if (!value) return "-";
  return value.slice(0, 5);
}
