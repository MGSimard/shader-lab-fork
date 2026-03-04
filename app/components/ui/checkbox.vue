<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from "reka-ui";
import { CheckIcon } from "lucide-vue-next";

const model = defineModel<boolean>({ default: true });
</script>

<template>
  <CheckboxRoot
    v-model="model"
    :class="[
      'flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
      'border-edge',
      model ? 'bg-inverse' : 'bg-surface-1',
      'cursor-pointer hover:border-primary/50',
    ]"
  >
    <CheckboxIndicator class="flex items-center justify-center">
      <CheckIcon v-if="model" class="size-3 text-base-0" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
