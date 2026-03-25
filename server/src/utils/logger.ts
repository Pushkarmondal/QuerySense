type LogLevel = "info" | "warn" | "error";

export const log = (
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
) => {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const output = JSON.stringify(entry);
  if (level === "error") {
    console.error(output);
    return;
  }
  console.log(output);
};

