<script setup lang="ts">
import type { Ref } from 'vue'
import { ref, inject } from 'vue'

const isLoading = inject<Ref<boolean>>('isLoading', ref(false))
</script>

<template>
  <HomeLoader v-if="isLoading" />
  <B24DashboardGroup
    v-else
    unit="px"
    storage="local"
  >
    <slot />
  </B24DashboardGroup>
</template>
