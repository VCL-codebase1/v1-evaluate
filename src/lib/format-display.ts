export function formatDateField(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(year, month - 1, day));
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function attachmentName(value: string) {
  const [name] = value.split("||");
  return (name || value).trim();
}

export function attachmentUrl(value: string) {
  const parts = value.split("||");
  return parts.length > 1 ? parts.slice(1).join("||") : value;
}

export function displayValue(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    const names = value.map((item) => attachmentName(item)).filter(Boolean);
    return names.length > 0 ? names.join(", ") : "—";
  }
  const trimmed = (value ?? "").trim();
  return trimmed || "—";
}
