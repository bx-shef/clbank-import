<script setup lang="ts">
import type { Ref } from 'vue'
import { ref, inject, onMounted } from 'vue'

const toast = useToast()
const isLoading = inject<Ref<boolean>>('isLoading', ref(false))

onMounted(async () => {
  const cookie = useCookie('cookie-consent')
  if (cookie.value === 'accepted') {
    return
  }

  toast.add({
    title: 'We use first-party cookies to enhance your experience on our app.',
    duration: 0,
    close: false,
    actions: [
      {
        label: 'Accept',
        color: 'air-primary-success',
        onClick: () => {
          cookie.value = 'accepted'
        }
      },
      {
        label: 'Opt out',
        color: 'air-secondary-no-accent'
      }
    ]
  })
})
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
