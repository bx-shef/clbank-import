export const FILE_SIGNATURE_1C = '1CClientBankExchange'
export const FILE_SIGNATURE_CLIENT_BANK = '***** ^Type='

export const BYTES_PER_KB = 1024
export const DEFAULT_LOCALE = 'ru-RU'
export const CSV_IMPORT_TITLE = 'Импорт из CSV'
export const CSV_DOCUMENT_TITLE = 'CSV файл'
export const CSV_DEFAULT_CURRENCY = 'RUB'

export const DEFAULT_CURRENCY = {
  code: 'BYN',
  number: 933
} as const

export const CURRENCY_MAP = {
  EUR: 978,
  USD: 840,
  CNY: 156,
  RUB: 643,
  BYN: 933
} as const
