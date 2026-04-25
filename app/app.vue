<script setup lang="ts">
import type { Result } from '@bitrix24/b24jssdk'
import type { ToasterProps } from '@bitrix24/b24ui-nuxt'
import { ref, provide, readonly } from 'vue'
import * as locales from '@bitrix24/b24ui-nuxt/locale'
import CloudErrorIcon from '@bitrix24/b24icons-vue/main/CloudErrorIcon'

const config = useRuntimeConfig()

const toast = useToast()
const b24Instance = useB24()
const { isBitrixMobile } = useDevice()

const isLoading = ref(true)
const toaster: ToasterProps = { position: isBitrixMobile.value ? 'bottom-center' : 'top-right' }

const lang = 'ru'
const dir = 'ltr'

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: `${config.app.baseURL}favicon.ico?v=2` }
  ],
  htmlAttrs: {
    lang,
    dir
  }
})

const title = 'Импорт банковских выписок'
const description = 'Загружаем выписку в Битрикс24.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})

provide('isLoading', readonly(isLoading))

onMounted(async () => {
  const result: Result = await b24Instance.init()
  if (!result.isSuccess) {
    toast.add({
      title: 'Error',
      description: result.getErrorMessages().join('\n'),
      color: 'air-primary-alert',
      icon: CloudErrorIcon
    })
  }
  isLoading.value = false
})
</script>

<template>
  <B24App :toaster="toaster" :locale="locales.ru">
    <NuxtLoadingIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </B24App>
</template>
