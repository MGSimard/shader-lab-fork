<script setup lang="ts">
import type { UniformDef, UniformValue, GradientStop } from "~/types";

type Props = {
  uniform: UniformDef;
};

const { uniform } = defineProps<Props>();

const model = defineModel<UniformValue>({ required: true });

const floatModel = computed({
  get: () => model.value as number,
  set: (v: number) => { model.value = v; },
});

const colorModel = computed({
  get: () => model.value as string,
  set: (v: string) => { model.value = v; },
});

const boolModel = computed({
  get: () => model.value as boolean,
  set: (v: boolean) => { model.value = v; },
});

const gradientModel = computed({
  get: () => model.value as GradientStop[],
  set: (v: GradientStop[]) => { model.value = v; },
});

function updateVec2X(x: number) {
  const current = model.value as [number, number];
  model.value = [x, current[1]];
}

function updateVec2Y(y: number) {
  const current = model.value as [number, number];
  model.value = [current[0], y];
}
</script>

<template>
  <!-- Float / Int -->
  <UiSliderField
    v-if="uniform.type === 'float' || uniform.type === 'int'"
    v-model="floatModel"
    :label="uniform.label"
    :min="uniform.min"
    :max="uniform.max"
    :step="uniform.step ?? (uniform.type === 'int' ? 1 : 0.01)"
  />

  <!-- Color -->
  <UiColorField
    v-else-if="uniform.type === 'color'"
    v-model="colorModel"
    :label="uniform.label"
  />

  <!-- Boolean -->
  <UiToggle
    v-else-if="uniform.type === 'bool'"
    v-model="boolModel"
    :label="uniform.label"
  />

  <!-- Vec2 -->
  <div
    v-else-if="uniform.type === 'vec2'"
    class="flex flex-col gap-2"
  >
    <UiSliderField
      :model-value="(model as [number, number])[0]"
      :label="`${uniform.label} X`"
      :min="uniform.min"
      :max="uniform.max"
      :step="uniform.step ?? 0.01"
      @update:model-value="updateVec2X"
    />
    <UiSliderField
      :model-value="(model as [number, number])[1]"
      :label="`${uniform.label} Y`"
      :min="uniform.min"
      :max="uniform.max"
      :step="uniform.step ?? 0.01"
      @update:model-value="updateVec2Y"
    />
  </div>

  <!-- Gradient -->
  <UiGradientField
    v-else-if="uniform.type === 'gradient'"
    v-model="gradientModel"
    :label="uniform.label"
  />
</template>
