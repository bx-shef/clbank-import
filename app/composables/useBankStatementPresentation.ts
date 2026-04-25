import { computed } from 'vue'
import { useFormatter } from '@bitrix24/b24jssdk'
import { DEFAULT_LOCALE } from '~/constants/clbank'
import { useB24 } from '~/composables/useB24'

function groupAccountValue(value: string): string {
  const normalized = value.replace(/\s+/g, '')
  const groups = normalized.match(/.{1,4}/g)
  return groups ? groups.join(' ') : normalized
}

export const useBankStatementPresentation = () => {
  const b24 = useB24()
  const { formatterNumber, formatterIban } = useFormatter()

  formatterNumber.setDefLocale(DEFAULT_LOCALE)

  const b24Lang = computed(() => {
    const helper = b24.getHelper()
    return helper?.licenseInfo?.data?.languageId ?? 'ru'
  })

  function formatNumberForDisplay(value: number): string {
    return formatterNumber.format(value, DEFAULT_LOCALE)
  }
  function formatAmountForDisplay(amount: number, currencyCode: string): string {
    const helper = b24.getHelper()

    if (helper?.isInit && currencyCode) {
      return helper.currency.format(amount, currencyCode, b24Lang.value)
    }

    const formattedAmount = formatNumberForDisplay(amount)
    return currencyCode ? `${formattedAmount} ${currencyCode}` : formattedAmount
  }

  function formatAccountDisplay(raw: null | string | undefined): string {
    if (!raw) {
      return 'не указан'
    }

    const normalized = raw.replace(/\s+/g, '')

    if (formatterIban.isValid(normalized)) {
      return formatterIban.printFormat(normalized)
    }

    return groupAccountValue(normalized)
  }

  return {
    formatAmountForDisplay,
    formatAccountDisplay,
    formatNumberForDisplay
  }
}
