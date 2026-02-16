<script setup lang="ts">
import experiments from "~/experiments";

useHead({ title: "Shader Lab" });

const experimentList = computed(() =>
  Object.values(experiments).map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
  })),
);
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-base-0 p-8">
    <div class="flex w-full max-w-md flex-col gap-6">
      <div class="flex flex-col gap-1">
        <h1 class="text-title-sm text-primary">Shader Lab</h1>
        <p class="text-copy text-secondary">Experiments</p>
      </div>
      <div class="flex flex-col gap-2">
        <NuxtLink
          v-for="exp in experimentList"
          :key="exp.id"
          :to="`/${exp.id}`"
          class="group flex flex-col gap-0.5 rounded-xl border border-edge bg-base-1 px-4 py-3 transition-all hover:border-edge-strong hover:bg-surface-1"
        >
          <span class="text-copy font-medium text-primary">{{ exp.name }}</span>
          <span class="text-copy-sm text-tertiary">{{ exp.description }}</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
