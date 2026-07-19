export type OutcomeMeanings = { yes: string; no: string; invalid: string };

const SCHEMA = "ocp-friends/outcomes";
const VERSION = 1;
const MAX_BYTES = 512;

const bytes = (value: string) => new TextEncoder().encode(value).length;

export function encodeOutcomeMeanings(values: OutcomeMeanings): string {
  return JSON.stringify({ schema: SCHEMA, version: VERSION, yes: values.yes.trim(), no: values.no.trim(), invalid: values.invalid.trim() });
}

export function validateOutcomeMeanings(values: OutcomeMeanings, zh: boolean): string {
  if (!values.yes.trim() || !values.no.trim() || !values.invalid.trim()) return zh
    ? "请分别填写 YES、NO 和 INVALID 的含义。"
    : "Enter separate meanings for YES, NO, and INVALID.";
  if (Object.values(values).some((value) => bytes(value.trim()) > MAX_BYTES)) return zh
    ? "每个选项的含义不能超过 512 字节。"
    : "Each outcome meaning must be 512 bytes or fewer.";
  return "";
}

export function decodeOutcomeMeanings(value: string): OutcomeMeanings | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.schema !== SCHEMA || parsed.version !== VERSION) return null;
    const result = { yes: parsed.yes, no: parsed.no, invalid: parsed.invalid };
    if (Object.values(result).some((item) => typeof item !== "string" || !item.trim() || bytes(item) > MAX_BYTES)) return null;
    return result as OutcomeMeanings;
  } catch { return null; }
}
