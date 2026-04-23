/**
 * Все константы и «enum»-значения (символьные XML_ID) для выгрузки/импорта
 * в универсальный список Bitrix24 (платежи).
 */

/**
 * `lists.field.get` не отдаёт XML_ID значений списка — только метки.
 * Сопоставление внутреннего кода (как в импорте) → точная подпись в B24.
 * Синхронизировать с настройками полей в Bitrix24.
 */
export const B24_LIST_ENUM_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  CATEGORY: {
    IN: 'Приход',
    OUT: 'Расход'
  },
  TYPE: {
    FULLPAY: 'Полная оплата',
    PREPAY: 'Частичная оплата'
  },
  METHOD: {
    CASH: 'Наличные',
    ACQUIRING: 'Эквайринг',
    ACQUIRING_INTERN: 'Интернет эквайринг',
    CASHLESS: 'Безнал',
    INNER: 'Внутренний счет (Бонусы)',
    NOTSET: '~ не определено ~'
  },
  STATUS: {
    NOT_PAID: 'Не оплачено',
    PAID: 'Оплачено',
    CANCEL: 'Отменено',
    RETURN: 'Возврат',
    TO_DELETE: 'Помечено на удаление'
  },
  STATUS_PROCESS: {
    NEW: 'Черновик',
    PROCESS: 'Обработка',
    SUCCESS: 'Успех',
    FAIL: 'Брак'
  }
} as const

/**
 * Коды полей (XML_ID), которые обязаны присутствовать в целевом списке
 * — проверяются после `lists.field.get`.
 */
export const B24_LIST_REQUIRED_FIELD_CODES = [
  'STATUS',
  'STATUS_PROCESS',
  'DOC_NUM',
  'DOC_DATE_TIME',
  'CATEGORY',
  'METHOD',
  'TYPE',
  'SUM',
  'COMMENT',
  'MY_COMPANY_LST_RQ',
  'MY_COMPANY_BANK_ACCNUM',
  'CLIENT_BANK_ACCNUM',
  'ARTICLE',
  'BASE_SUM',
  'SYS_INFO'
] as const

export type B24ListFieldCode = (typeof B24_LIST_REQUIRED_FIELD_CODES)[number]

/**
 * Для валидации: по каждому полю-списку — какие значения (XML) должны разрешаться.
 */
export const B24_LIST_REQUIRED_ENUMS: Readonly<Record<string, readonly string[]>> = {
  CATEGORY: ['IN', 'OUT'],
  TYPE: ['FULLPAY'],
  METHOD: ['CASHLESS'],
  STATUS: ['PAID'],
  STATUS_PROCESS: ['PROCESS']
}

export const B24_CURRENCY_BYN = 'BYN' as const

/**
 * Символьные значения, передаваемые в `getEnumId` при создании элемента.
 */
export const B24_IMPORT_ENUM = {
  STATUS: { PAID: 'PAID' },
  STATUS_PROCESS: { PROCESS: 'PROCESS' },
  CATEGORY: { IN: 'IN', OUT: 'OUT' },
  METHOD: { CASHLESS: 'CASHLESS' },
  TYPE: { FULLPAY: 'FULLPAY' }
} as const

/** Маркер в SYS_INFO, что запись пришла из импорта клиент-банка */
export const B24_IMPORT_SYS_INFO_MARKER = 'IMPORT_CLIENT_BANK_FROM_FILE'

/**
 * Шаблоны наименования в Bitrix (NAME, DETAIL_TEXT).
 * `{inOut}` / `{name}` / `{date}` / `{unp}` / `{desc}` — подставляются в composable.
 */
export const B24_IMPORT_ELEMENT_TEXT = {
  nameIn: 'Приход от',
  nameOut: 'Расход на',
  nameSuffix: ' за ',
  detailTextPrefix: 'Назначение: ',
  detailTextUnpLabel: ' УНП: '
} as const
