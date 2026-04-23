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
      /**
       * Bitrix24 universal list configuration.
       * Values below are fallback defaults and must be overridden per Bitrix24 account
       * via NUXT_PUBLIC_B24_* environment variables (see .env.example).
       * Field IDs are numeric property IDs (e.g. "175" — prefix "PROPERTY_" is added at runtime).
       */
      b24: {
        iblockTypeId: 'lists',
        iblockId: 31,
        field: {
          paymentType: '173',
          amount: '175',
          currency: '207',
          operationDate: '209',
          docNumber: '163',
          ourAcc: '185',
          clientAcc: '189',
          clientName: '211',
          clientUnp: '213',
          description: '215',
          hashId: '217',
          category: '169',
          method: '171',
          docDateTime: '165'
        },
        paymentCategoryIn: '127',
        paymentCategoryOut: '129',
        paymentTypeFull: '143',
        paymentMethodNonCash: '137'
      }
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
