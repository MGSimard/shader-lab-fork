<script setup lang="ts">
import type { Experiment } from "#shared/types";

type Props = {
  experiment: Experiment;
};

const { experiment } = defineProps<Props>();
const enabledGroupsRef = inject<Ref<Record<string, boolean>>>("enabledGroupsRef");

const canvasRef = ref<HTMLCanvasElement | null>(null);
const { values, capture, pause, resume, getCanvas, configureRenderer, restoreRenderer, renderFrame } = useShader(canvasRef, experiment, enabledGroupsRef);

useUrlState(values, experiment);

defineExpose({ values, capture, pause, resume, getCanvas, configureRenderer, restoreRenderer, renderFrame });
</script>

<template>
  <canvas
    ref="canvasRef"
    class="fixed inset-0 size-full"
  />
</template>
