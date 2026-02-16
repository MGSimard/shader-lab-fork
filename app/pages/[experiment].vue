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

// Dynamic OG image: clean .png URL for maximum social platform compatibility
const ogImageUrl = computed(() => {
  const s = route.query.s as string | undefined;
  if (s) {
    return `https://shader.zeitwork.com/og/${experimentId}/${s}.png`;
  }
  return `https://shader.zeitwork.com/og/${experimentId}.png`;
});

useSeoMeta({
  ogTitle: () => `${experiment.name} — Shader Lab`,
  ogDescription: experiment.description,
  ogImage: ogImageUrl,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: "image/png",
  ogUrl: () => `https://shader.zeitwork.com/${experimentId}`,
  twitterCard: "summary_large_image",
  twitterSite: "@zeitwork",
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
