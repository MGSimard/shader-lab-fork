import type { Experiment, GradientStop, UniformDef, UniformValue } from "#shared/types";

type UniformValues = Record<string, UniformValue>;

// --- Base64url encoding (URL-safe, no padding) — kept for legacy decode ---

function fromBase64url(str: string): string {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad === 2) b64 += "==";
  else if (pad === 3) b64 += "=";
  return atob(b64);
}

// --- Compact gradient encoding ---
// Format: "hex:pos!hex:pos!..." where hex has no # and pos is a percentage (0-100)

function encodeGradient(stops: GradientStop[]): string {
  return stops
    .map((s) => {
      const hex = s.color.replace("#", "");
      const pos = Math.round(s.position * 10000) / 100;
      const posStr = pos % 1 === 0 ? String(pos) : pos.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
      return `${hex}:${posStr}`;
    })
    .join("!");
}

function decodeGradient(str: string): GradientStop[] | null {
  // Support both "!" (current) and "|" (legacy) as stop separators
  const parts = str.split(/[!|]/);
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

function encodeVec2(v: [number, number], step?: number): string {
  return `${roundToPrecision(v[0], step)},${roundToPrecision(v[1], step)}`;
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

// --- Helpers ---

const ENTRY_SEPARATOR = "~";

/** Flatten all uniform definitions from an experiment in definition order. */
function flattenUniforms(experiment: Experiment): UniformDef[] {
  const defs: UniformDef[] = [];
  for (const group of experiment.groups) {
    for (const def of group.uniforms) {
      defs.push(def);
    }
  }
  return defs;
}

/** Derive the number of decimal places from a uniform's step value. */
function precisionFromStep(step?: number): number {
  if (step === undefined || step <= 0) return 2;
  if (step >= 1) return 0;
  const str = step.toString();
  const dotIdx = str.indexOf(".");
  if (dotIdx === -1) return 0;
  return str.length - dotIdx - 1;
}

/** Round a number to the given precision and return a minimal string representation. */
function roundToPrecision(value: number, step?: number): string {
  const precision = precisionFromStep(step);
  const rounded = Number(value.toFixed(precision));
  return String(rounded);
}

// --- Encode: values → index-prefixed string ---
// Format: "idx=value~idx=value~..." where idx is the uniform's position in the flat list.
// Only non-default values are included. No base64 wrapping.

export function encodeState(values: UniformValues, experiment: Experiment): string {
  const defs = flattenUniforms(experiment);
  const parts: string[] = [];

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i]!;
    const val = values[def.name];

    if (val === undefined || valuesEqual(val, def.default)) continue;

    let encoded: string;
    switch (def.type) {
      case "float":
        encoded = roundToPrecision(val as number, def.step);
        break;
      case "int":
        encoded = String(Math.round(val as number));
        break;
      case "bool":
        encoded = (val as boolean) ? "1" : "0";
        break;
      case "color":
        encoded = (val as string).replace("#", "");
        break;
      case "vec2":
        encoded = encodeVec2(val as [number, number], def.step);
        break;
      case "gradient":
        encoded = encodeGradient(val as GradientStop[]);
        break;
      default:
        continue;
    }

    parts.push(`${i}=${encoded}`);
  }

  return parts.length > 0 ? parts.join(ENTRY_SEPARATOR) : "";
}

// --- Decode: index-prefixed string → validated values ---

function decodeStateIndexed(
  encoded: string,
  experiment: Experiment,
): UniformValues | null {
  try {
    const defs = flattenUniforms(experiment);
    const entries = encoded.split(ENTRY_SEPARATOR);
    const result: UniformValues = {};

    for (const entry of entries) {
      const eqIdx = entry.indexOf("=");
      if (eqIdx === -1) continue;

      const idx = parseInt(entry.slice(0, eqIdx), 10);
      const token = entry.slice(eqIdx + 1);
      if (!Number.isFinite(idx) || idx < 0 || idx >= defs.length) continue;
      if (!token) continue;

      const def = defs[idx]!;

      switch (def.type) {
        case "float": {
          const v = parseFloat(token);
          if (Number.isFinite(v)) result[def.name] = v;
          break;
        }
        case "int": {
          const v = parseInt(token, 10);
          if (Number.isFinite(v)) result[def.name] = v;
          break;
        }
        case "bool":
          if (token === "1") result[def.name] = true;
          else if (token === "0") result[def.name] = false;
          break;
        case "color":
          if (/^[0-9a-f]{6}$/i.test(token)) {
            result[def.name] = `#${token}`;
          }
          break;
        case "vec2": {
          const v = decodeVec2(token);
          if (v) result[def.name] = v;
          break;
        }
        case "gradient": {
          const stops = decodeGradient(token);
          if (stops) result[def.name] = stops;
          break;
        }
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

// --- Legacy decode: base64url JSON → validated values ---

function decodeStateLegacy(
  encoded: string,
  experiment: Experiment,
): UniformValues | null {
  try {
    const json = fromBase64url(encoded);
    const compact = JSON.parse(json);
    if (typeof compact !== "object" || compact === null) return null;

    const result: UniformValues = {};

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

// --- Public decode with format detection ---
// Two formats supported:
// 1. Index-prefixed (new):  "0=0.92~1=5.3~6=2.1"
// 2. Legacy base64+JSON:    "eyJzcGVlZCI6MC45Mn0"

export function decodeState(
  encoded: string,
  experiment: Experiment,
): UniformValues | null {
  if (!encoded) return null;

  // Try legacy base64+JSON: decodes to a string starting with "{"
  try {
    const json = fromBase64url(encoded);
    if (json.startsWith("{")) {
      return decodeStateLegacy(encoded, experiment);
    }
  } catch {
    // Not valid base64 — fall through to index-prefixed
  }

  // Index-prefixed format
  return decodeStateIndexed(encoded, experiment);
}
