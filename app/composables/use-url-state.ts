import { useDebounceFn } from "@vueuse/core";
import type { Experiment, GradientStop, UniformValue } from "#shared/types";
import { encodeState, decodeState } from "#shared/utils/url-state";

type UniformValues = Record<string, UniformValue>;

const QUERY_KEY = "s";

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
    const decoded = decodeState(encoded, experiment);
    if (decoded) {
      for (const [key, val] of Object.entries(decoded)) {
        // Deep clone gradient stops to ensure reactivity independence
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
          values[key] = (val as GradientStop[]).map((s) => ({ ...s }));
        } else {
          values[key] = val;
        }
      }
    }
  }

  // --- Sync to URL on change ---
  const pushToUrl = useDebounceFn(() => {
    const encoded = encodeState(values, experiment);
    router.replace({
      query: encoded ? { [QUERY_KEY]: encoded } : {},
    });
  }, 300);

  watch(() => values, pushToUrl, { deep: true });
}
