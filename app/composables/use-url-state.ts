import { useDebounceFn } from "@vueuse/core";
import type { Experiment, GradientStop, UniformValue } from "~/types";

type UniformValues = Record<string, UniformValue>;

const QUERY_KEY = "s";

function encode(values: UniformValues): string {
  const json = JSON.stringify(values);
  return btoa(json);
}

function decode(encoded: string): UniformValues | null {
  try {
    const json = atob(encoded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Validates and coerces a decoded value against the uniform definition.
 * Returns the validated value, or null if it's invalid.
 */
function validateValue(
  raw: unknown,
  type: string,
): UniformValue | null {
  switch (type) {
    case "float":
    case "int":
      return typeof raw === "number" && Number.isFinite(raw) ? raw : null;

    case "bool":
      return typeof raw === "boolean" ? raw : null;

    case "color":
      return typeof raw === "string" && /^#[0-9a-f]{6}$/i.test(raw)
        ? raw
        : null;

    case "vec2":
      return Array.isArray(raw) &&
        raw.length === 2 &&
        typeof raw[0] === "number" &&
        typeof raw[1] === "number"
        ? (raw as [number, number])
        : null;

    case "gradient": {
      if (!Array.isArray(raw) || raw.length === 0) return null;
      const stops = raw.filter(
        (s): s is GradientStop =>
          typeof s === "object" &&
          s !== null &&
          typeof s.color === "string" &&
          /^#[0-9a-f]{6}$/i.test(s.color) &&
          typeof s.position === "number" &&
          s.position >= 0 &&
          s.position <= 1,
      );
      return stops.length >= 2 ? stops : null;
    }

    default:
      return null;
  }
}

/**
 * Reads initial state from the URL and sets up live syncing of
 * uniform values to the `?s=` query parameter.
 *
 * Call this after `useShader` has initialized `values` with defaults.
 * Any values found in the URL will override the defaults in-place.
 */
export function useUrlState(
  values: UniformValues,
  experiment: Experiment,
) {
  const router = useRouter();
  const route = useRoute();

  // --- Restore from URL on init ---
  const encoded = route.query[QUERY_KEY];
  if (typeof encoded === "string" && encoded.length > 0) {
    const decoded = decode(encoded);
    if (decoded) {
      // Build a lookup of uniform name -> type for validation
      const uniformTypes = new Map<string, string>();
      for (const group of experiment.groups) {
        for (const def of group.uniforms) {
          uniformTypes.set(def.name, def.type);
        }
      }

      for (const [key, raw] of Object.entries(decoded)) {
        const type = uniformTypes.get(key);
        if (!type) continue; // unknown uniform, skip

        const validated = validateValue(raw, type);
        if (validated !== null) {
          // Deep clone gradient stops to ensure reactivity independence
          if (type === "gradient" && Array.isArray(validated)) {
            values[key] = (validated as GradientStop[]).map((s) => ({ ...s }));
          } else {
            values[key] = validated;
          }
        }
      }
    }
  }

  // --- Sync to URL on change ---
  const pushToUrl = useDebounceFn(() => {
    const encoded = encode(values);
    router.replace({
      query: { [QUERY_KEY]: encoded },
    });
  }, 300);

  watch(() => values, pushToUrl, { deep: true });
}
