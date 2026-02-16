<script setup lang="ts">
import { DownloadIcon, RotateCcwIcon, SettingsIcon, XIcon } from "lucide-vue-next";
import type { Experiment, GradientStop, UniformValue } from "~/types";

type Props = {
  experiment: Experiment;
};

const { experiment } = defineProps<Props>();
const emit = defineEmits<{ download: [] }>();

const values = defineModel<Record<string, UniformValue>>({ required: true });

const collapsed = ref(false);

function resetToDefaults() {
  for (const group of experiment.groups) {
    for (const def of group.uniforms) {
      if (def.type === "gradient") {
        values.value[def.name] = (def.default as GradientStop[]).map((s) => ({ ...s }));
      } else {
        values.value[def.name] = def.default;
      }
    }
  }
}
</script>

<template>
  <!-- Collapsed: stacked icon buttons -->
  <div
    v-if="collapsed"
    class="fixed right-4 top-4 z-50 flex flex-col gap-2"
  >
    <button
      class="flex size-9 items-center justify-center rounded-xl border border-edge bg-base-1 text-secondary shadow-lg backdrop-blur-xl transition-colors hover:bg-surface-1 hover:text-primary"
      @click="collapsed = false"
    >
      <SettingsIcon class="size-4" />
    </button>
    <button
      class="flex size-9 items-center justify-center rounded-xl border border-edge bg-base-1 text-secondary shadow-lg backdrop-blur-xl transition-colors hover:bg-surface-1 hover:text-primary"
      title="Download 5K PNG"
      @click="emit('download')"
    >
      <DownloadIcon class="size-4" />
    </button>
  </div>

  <!-- Expanded: sidebar container -->
  <Transition
    enter-active-class="transition-all duration-300 ease-out-expo"
    enter-from-class="translate-x-4 opacity-0"
    enter-to-class="translate-x-0 opacity-100"
    leave-active-class="transition-all duration-200 ease-out-expo"
    leave-from-class="translate-x-0 opacity-100"
    leave-to-class="translate-x-4 opacity-0"
  >
    <div
      v-if="!collapsed"
      class="fixed right-4 top-4 bottom-4 z-40 flex w-72 flex-col gap-3"
    >
      <!-- Panel -->
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-edge bg-base-1/80 shadow-2xl backdrop-blur-xl">
        <!-- Header -->
        <div class="flex shrink-0 items-center justify-between border-b border-edge px-3 py-2.5">
          <div class="flex flex-col">
            <span class="text-copy-sm font-medium text-primary">{{ experiment.name }}</span>
            <span class="text-copy-xs text-tertiary">{{ experiment.description }}</span>
          </div>
          <div class="flex items-center gap-0.5">
            <button
              class="flex size-6 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-surface-1 hover:text-secondary"
              title="Reset to defaults"
              @click="resetToDefaults"
            >
              <RotateCcwIcon class="size-3.5" />
            </button>
            <button
              class="flex size-6 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-surface-1 hover:text-secondary"
              @click="collapsed = true"
            >
              <XIcon class="size-3.5" />
            </button>
          </div>
        </div>

        <!-- Controls -->
        <div class="flex-1 overflow-y-auto">
          <div class="flex flex-col divide-y divide-edge">
            <ControlsControlGroup
              v-for="group in experiment.groups"
              :key="group.label"
              :label="group.label"
            >
              <ControlsUniformControl
                v-for="uniform in group.uniforms"
                :key="uniform.name"
                v-model="values[uniform.name]"
                :uniform="uniform"
              />
            </ControlsControlGroup>
          </div>
        </div>
      </div>

      <!-- Download button -->
      <button
        class="flex size-9 shrink-0 items-center justify-center self-end rounded-xl border border-edge bg-base-1 text-secondary shadow-lg backdrop-blur-xl transition-colors hover:bg-surface-1 hover:text-primary"
        title="Download 5K PNG"
        @click="emit('download')"
      >
        <DownloadIcon class="size-4" />
      </button>
    </div>
  </Transition>
</template>
