export function uniqueConstraint(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    if ("code" in current && current.code === "23505") {
      return "constraint" in current && typeof current.constraint === "string" ? current.constraint : "unique";
    }
    current = "cause" in current ? current.cause : null;
  }
  return null;
}
