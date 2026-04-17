const pagesService = [
  '/api/customers',
  '/api/mails',
  '/api/members',
  '/api/notifications',
  '/404.html'
]

const extraAllowedHosts = (process?.env.NUXT_ALLOWED_HOSTS?.split(',').map((s: string) => s.trim()).filter(Boolean)) ?? []

const prodUrl = process?.env.NUXT_PUBLIC_SITE_URL ?? ''

export default defineNuxtConfig({

  modules: [
    '@nuxt/eslint',
    '@bitrix24/b24ui-nuxt',
    '@bitrix24/b24jssdk-nuxt',
    '@vueuse/nuxt'
  ], devtools: { enabled: false },

  app: {
    rootAttrs: { 'data-vaul-drawer-wrapper': '' }
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    /**
     * @memo this will be overwritten from .env or Docker_*
     * @see https://nuxt.com/docs/guide/going-further/runtime-config#example
     */
    public: {
      siteUrl: prodUrl,
      /** ID типа смарт-процесса для crm.item.* — на каждом портале Bitrix24 свой (см. URL /crm/type/{id}/). */
      b24SmartEntityTypeId: Number(process.env.NUXT_PUBLIC_B24_SMART_ENTITY_TYPE_ID) || 1036,
      b24CategoryInId: Number(process.env.NUXT_PUBLIC_B24_CATEGORY_IN_ID) || 14,
      b24CategoryOutId: Number(process.env.NUXT_PUBLIC_B24_CATEGORY_OUT_ID) || 16
    }
  },

  routeRules: {
    '/api/**': {
      cors: true
    }
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    prerender: {
      routes: [
        ...pagesService
      ],
      crawlLinks: true,
      autoSubfolderIndex: false
    }
  },

  vite: {
    plugins: [],
    server: {
      // Fix: "Blocked request. This host is not allowed" when using tunnels like ngrok
      allowedHosts: [...extraAllowedHosts]
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
