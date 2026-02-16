<script setup lang="ts">
import type { Experiment } from "~/types";

type Props = {
  experiment: Experiment;
};

const { experiment } = defineProps<Props>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const { values } = useShader(canvasRef, experiment);

defineExpose({ values });
</script>

<template>
  <canvas
    ref="canvasRef"
    class="fixed inset-0 size-full"
  />
</template>
