import type { Experiment, GradientStop, UniformValue } from "#shared/types";

type UniformValues = Record<string, UniformValue>;

// --- Base64url encoding (URL-safe, no padding) ---

function toBase64url(str: string): string {
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(str: string): string {
  // Restore standard base64
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding
  const pad = b64.length % 4;
  if (pad === 2) b64 += "==";
  else if (pad === 3) b64 += "=";
  return atob(b64);
}

// --- Compact gradient encoding ---
// Format: "hex:pos|hex:pos|..." where hex has no # and pos is a percentage (0-100)

function encodeGradient(stops: GradientStop[]): string {
  return stops
    .map((s) => {
      const hex = s.color.replace("#", "");
      // Round position to 2 decimal places as percentage
      const pos = Math.round(s.position * 10000) / 100;
      // Use integer if whole number
      const posStr = pos % 1 === 0 ? String(pos) : pos.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
      return `${hex}:${posStr}`;
    })
    .join("|");
}

function decodeGradient(str: string): GradientStop[] | null {
  const parts = str.split("|");
  if (parts.length < 2) return null;

  const stops: GradientStop[] = [];
  for (const part of parts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) return null;
    const hex = part.slice(0, colonIdx);
    const posStr = part.slice(colonIdx + 1);
    if (!hex || !posStr) return null;
    if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
    const pos = parseFloat(posStr) / 100;
    if (!Number.isFinite(pos) || pos < 0 || pos > 1) return null;
    stops.push({ color: `#${hex}`, position: pos });
  }
  return stops;
}

// --- Compact vec2 encoding ---

function encodeVec2(v: [number, number]): string {
  return `${v[0]},${v[1]}`;
}

function decodeVec2(str: string): [number, number] | null {
  const commaIdx = str.indexOf(",");
  if (commaIdx === -1) return null;
  const x = parseFloat(str.slice(0, commaIdx));
  const y = parseFloat(str.slice(commaIdx + 1));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [x, y];
}

// --- Deep equality check for uniform values ---

function valuesEqual(a: UniformValue, b: UniformValue): boolean {
  if (typeof a !== typeof b) return false;
  if (typeof a === "number" || typeof a === "boolean" || typeof a === "string") {
    return a === b;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    // vec2
    if (typeof a[0] === "number" && typeof b[0] === "number") {
      return a[0] === b[0] && a[1] === b[1];
    }
    // gradient
    return a.every((stop, i) => {
      const sa = stop as GradientStop;
      const sb = b[i] as GradientStop;
      return sa.color === sb.color && sa.position === sb.position;
    });
  }
  return false;
}

// --- Encode: values → compact base64url string ---

export function encodeState(values: UniformValues, experiment: Experiment): string {
  // Build compact object with only non-default values
  const compact: Record<string, string | number | boolean> = {};

  for (const group of experiment.groups) {
    for (const def of group.uniforms) {
      const val = values[def.name];
      if (val === undefined) continue;
      if (valuesEqual(val, def.default)) continue;

      switch (def.type) {
        case "float":
        case "int":
          compact[def.name] = val as number;
          break;
        case "bool":
          compact[def.name] = val as boolean;
          break;
        case "color":
          compact[def.name] = (val as string).replace("#", "");
          break;
        case "vec2":
          compact[def.name] = encodeVec2(val as [number, number]);
          break;
        case "gradient":
          compact[def.name] = encodeGradient(val as GradientStop[]);
          break;
      }
    }
  }

  if (Object.keys(compact).length === 0) return "";

  const json = JSON.stringify(compact);
  return toBase64url(json);
}

// --- Decode: compact base64url string → validated values ---

export function decodeState(
  encoded: string,
  experiment: Experiment,
): UniformValues | null {
  try {
    const json = fromBase64url(encoded);
    const compact = JSON.parse(json);
    if (typeof compact !== "object" || compact === null) return null;

    const result: UniformValues = {};

    // Build type lookup
    const uniformDefs = new Map<string, { type: string; def: UniformValue }>();
    for (const group of experiment.groups) {
      for (const def of group.uniforms) {
        uniformDefs.set(def.name, { type: def.type, def: def.default });
      }
    }

    for (const [key, raw] of Object.entries(compact)) {
      const info = uniformDefs.get(key);
      if (!info) continue;

      switch (info.type) {
        case "float":
        case "int":
          if (typeof raw === "number" && Number.isFinite(raw)) {
            result[key] = raw;
          }
          break;
        case "bool":
          if (typeof raw === "boolean") {
            result[key] = raw;
          }
          break;
        case "color":
          if (typeof raw === "string" && /^[0-9a-f]{6}$/i.test(raw)) {
            result[key] = `#${raw}`;
          }
          break;
        case "vec2":
          if (typeof raw === "string") {
            const v = decodeVec2(raw);
            if (v) result[key] = v;
          }
          break;
        case "gradient":
          if (typeof raw === "string") {
            const stops = decodeGradient(raw);
            if (stops) result[key] = stops;
          }
          break;
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}
