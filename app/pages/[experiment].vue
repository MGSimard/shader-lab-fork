<script setup lang="ts">
import type { UniformValue } from "~/types";
import experiments from "~/experiments";

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

const canvasRef = ref<{
  values: Record<string, UniformValue>;
  capture: (width: number, height: number) => Promise<void>;
} | null>(null);

function download() {
  canvasRef.value?.capture(5120, 2880);
}
</script>

<template>
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
</template>
