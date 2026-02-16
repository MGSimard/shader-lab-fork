<script setup lang="ts">
import type { UniformValue } from "#shared/types";
import experiments from "#shared/experiments";

const route = useRoute();
const experimentId = route.params.experiment as string;

const experiment = experiments[experimentId];

if (!experiment) {
  throw createError({
    statusCode: 404,
    statusMessage: `Experiment "${experimentId}" not found`,
  });
}

useHead({ title: `${experiment.name} — Shader Lab` });

// Dynamic OG image based on current URL state
const ogImageUrl = computed(() => {
  const params = new URLSearchParams({ id: experimentId });
  const s = route.query.s;
  if (s) params.set("s", s as string);
  return `https://shader.zeitwork.com/api/og?${params}`;
});

useSeoMeta({
  ogTitle: () => `${experiment.name} — Shader Lab`,
  ogDescription: experiment.description,
  ogImage: ogImageUrl,
  twitterCard: "summary_large_image",
  twitterTitle: () => `${experiment.name} — Shader Lab`,
  twitterDescription: experiment.description,
  twitterImage: ogImageUrl,
});

const canvasRef = ref<{
  values: Record<string, UniformValue>;
  capture: (width: number, height: number) => Promise<void>;
} | null>(null);

function download() {
  canvasRef.value?.capture(5120, 2880);
}
</script>

<template>
  <ClientOnly>
    <CanvasShaderCanvas
      ref="canvasRef"
      :experiment="experiment"
    />
    <ControlsControlPanel
      v-if="canvasRef"
      v-model="canvasRef.values"
      :experiment="experiment"
      @download="download"
    />
  </ClientOnly>
</template>
