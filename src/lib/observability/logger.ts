type Level = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function emit(level: Level, event: string, fields: LogFields = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  // Do not pass secrets, tokens, passwords, or raw reset tokens.
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};

export function requestMeta(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 200);
  return { ip, userAgent };
}
