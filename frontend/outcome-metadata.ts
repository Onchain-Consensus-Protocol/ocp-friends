export type OutcomeMeanings = { yes: string; no: string };
export type DecodedOutcomeMeanings = OutcomeMeanings & { invalid?: string };

const SCHEMA = "ocp-friends/outcomes";
const VERSION = 2;
const MAX_BYTES = 512;

const bytes = (value: string) => new TextEncoder().encode(value).length;

export function encodeOutcomeMeanings(values: OutcomeMeanings): string {
  return JSON.stringify({ schema: SCHEMA, version: VERSION, yes: values.yes.trim(), no: values.no.trim() });
}

export function validateOutcomeMeanings(values: OutcomeMeanings, zh: boolean): string {
  if (!values.yes.trim() || !values.no.trim()) return zh
    ? "请分别填写 YES 和 NO 的含义。"
    : "Enter separate meanings for YES and NO.";
  if (Object.values(values).some((value) => bytes(value.trim()) > MAX_BYTES)) return zh
    ? "每个选项的含义不能超过 512 字节。"
    : "Each outcome meaning must be 512 bytes or fewer.";
  return "";
}

export function decodeOutcomeMeanings(value: string): DecodedOutcomeMeanings | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.schema !== SCHEMA || (parsed.version !== 1 && parsed.version !== VERSION)) return null;
    const result = parsed.version === 1
      ? { yes: parsed.yes, no: parsed.no, invalid: parsed.invalid }
      : { yes: parsed.yes, no: parsed.no };
    if (Object.values(result).some((item) => typeof item !== "string" || !item.trim() || bytes(item) > MAX_BYTES)) return null;
    return result as DecodedOutcomeMeanings;
  } catch { return null; }
}
