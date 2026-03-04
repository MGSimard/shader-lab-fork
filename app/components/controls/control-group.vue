<script setup lang="ts">
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from "reka-ui";
import { ChevronRightIcon } from "lucide-vue-next";

type Props = {
  label: string;
  defaultOpen?: boolean;
  enableUniform?: string;
  enabled?: boolean;
};

const { label, defaultOpen = true, enableUniform, enabled = true } = defineProps<Props>();
const emit = defineEmits<{ "update:enabled": [value: boolean] }>();

const open = ref(defaultOpen);

const isEnabled = computed({
  get: () => enabled,
  set: (v) => emit("update:enabled", v),
});
</script>

<template>
  <CollapsibleRoot v-model:open="open">
    <CollapsibleTrigger
      class="flex w-full cursor-default items-center gap-1.5 px-3 py-2 text-copy-sm font-medium text-secondary transition-colors select-none hover:text-primary"
    >
      <ChevronRightIcon
        :class="[
          'size-3.5 text-tertiary transition-transform duration-150 ease-out-expo',
          open && 'rotate-90',
        ]"
      />
      {{ label }}
      <div
        v-if="enableUniform"
        class="ml-auto shrink-0"
        @click.stop
      >
        <UiCheckbox v-model="isEnabled" />
      </div>
    </CollapsibleTrigger>
    <CollapsibleContent
      class="overflow-hidden data-[state=closed]:animate-collapse data-[state=open]:animate-expand"
    >
      <div class="flex flex-col gap-2.5 px-3 pb-3">
        <slot />
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
