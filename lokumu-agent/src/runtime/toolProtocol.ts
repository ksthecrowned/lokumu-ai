export function parseToolCall(raw: string) {
  const cleaned = raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("NO_JSON_FOUND");
  }

  const jsonString = cleaned.slice(start, end + 1);

  return JSON.parse(jsonString);
}
