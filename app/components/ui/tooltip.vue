<script setup lang="ts">
import { TooltipRoot, TooltipTrigger, TooltipContent, TooltipPortal } from "reka-ui";

type Props = {
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  forceOpen?: boolean;
};

const { label, side = "bottom", forceOpen = false } = defineProps<Props>();

const hovered = ref(false);

const isOpen = computed(() => forceOpen || hovered.value);
</script>

<template>
  <TooltipRoot :open="isOpen" @update:open="hovered = $event">
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        :side="side"
        :side-offset="8"
        class="z-50 rounded-lg border border-edge bg-base-1 px-2.5 py-1.5 text-copy-xs text-secondary shadow-lg backdrop-blur-xl animate-contentShow"
      >
        {{ label }}
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
