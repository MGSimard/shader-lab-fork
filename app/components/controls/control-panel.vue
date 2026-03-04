<script setup lang="ts">
import { CameraIcon, RotateCcwIcon, SettingsIcon, ShareIcon, XIcon } from "lucide-vue-next";
import type { Experiment, GradientStop, UniformValue } from "#shared/types";

type ShaderControls = {
  capture: (width: number, height: number) => Promise<void>;
  pause: () => void;
  resume: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  configureRenderer: (width: number, height: number) => void;
  restoreRenderer: () => void;
  renderFrame: (time: number) => void;
};

type Props = {
  experiment: Experiment;
  shader: ShaderControls | null;
};

type Emits = {
  capture: [];
};

const { experiment, shader = null } = defineProps<Props>();
const emit = defineEmits<Emits>();

const values = defineModel<Record<string, UniformValue>>({ required: true });
const enabledGroups = defineModel<Record<string, boolean>>("enabledGroups", { default: () => ({}) });

const panelOpen = ref(false);
const copied = ref(false);
const exportOpen = ref(false);

function copyUrl() {
  navigator.clipboard.writeText(window.location.href);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}

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
  <div class="fixed right-4 top-4 z-50 flex gap-2">
    <UiTooltip :label="copied ? 'Copied!' : 'Copy settings URL'" :force-open="copied">
      <UiButton variant="toolbar" @click="copyUrl">
        Share
      </UiButton>
    </UiTooltip>
    <UiTooltip label="Capture screenshot">
      <UiButton variant="toolbar" :icon-left="CameraIcon" @click="emit('capture')" />
    </UiTooltip>
    <UiTooltip label="Export">
      <UiButton variant="toolbar" :icon-left="ShareIcon" @click="exportOpen = true" />
    </UiTooltip>
    <ControlsExportDialog
      v-model:open="exportOpen"
      :experiment-id="experiment.id"
      :shader="shader"
    />
    <UiTooltip :label="panelOpen ? 'Close settings' : 'Settings'">
      <UiButton variant="toolbar" :icon-left="panelOpen ? XIcon : SettingsIcon" @click="panelOpen = !panelOpen" />
    </UiTooltip>
  </div>

  <Transition
    enter-active-class="transition-all duration-300 ease-out-expo"
    enter-from-class="translate-x-4 opacity-0"
    enter-to-class="translate-x-0 opacity-100"
    leave-active-class="transition-all duration-200 ease-out-expo"
    leave-from-class="translate-x-0 opacity-100"
    leave-to-class="translate-x-4 opacity-0"
  >
    <div
      v-if="panelOpen"
      class="fixed right-4 top-16 bottom-4 z-40 flex w-72 flex-col"
    >
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-edge bg-base-1/80 shadow-2xl backdrop-blur-xl">
        <div class="flex shrink-0 items-center justify-between border-b border-edge px-3 py-2.5">
          <div class="flex flex-col">
            <span class="text-copy-sm font-medium text-primary">{{ experiment.name }}</span>
            <span class="text-copy-xs text-tertiary">{{ experiment.description }}</span>
          </div>
          <UiButton variant="ghost" size="sm" :icon-left="RotateCcwIcon" title="Reset to defaults" @click="resetToDefaults" />
        </div>

        <div class="flex-1 overflow-y-auto">
          <div class="flex flex-col divide-y divide-edge">
            <ControlsControlGroup
              v-for="group in experiment.groups"
              :key="group.label"
              :label="group.label"
              :enable-uniform="group.enableUniform"
              :enabled="enabledGroups[group.label] ?? true"
              @update:enabled="(v) => { enabledGroups[group.label] = v }"
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
    </div>
  </Transition>
</template>
