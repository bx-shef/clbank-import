import type { TypeB24 } from '@bitrix24/b24jssdk'

/**
 * Resolves Bitrix24 universal-list schema at runtime.
 *
 * Instead of hard-coding numeric property IDs and enum-value IDs in the .env,
 * the application relies on stable symbolic codes (XML_ID) of fields and
 * list-values. This composable performs a single `lists.field.get` call and
 * caches two maps:
 *
 * 1. `xmlId -> FIELD_ID` (e.g. `SUM -> PROPERTY_175`) used as keys when
 *    creating/updating list elements.
 * 2. `xmlId + enumXmlId -> enumId` (e.g. `STATUS` + `PAID -> 71`) used as
 *    values for list-type fields.
 */

type B24ListFieldRaw = {
  FIELD_ID?: string
  ID?: string | number
  CODE?: string | null
  TYPE?: string
  PROPERTY_TYPE?: string
  /**
   * In Bitrix24 universal lists the `lists.field.get` endpoint does not expose
   * XML_ID of list-type values, only a `{ id -> displayLabel }` map.
   */
  DISPLAY_VALUES_FORM?: Record<string, string> | null
}

type B24ListFieldResponse = Record<string, B24ListFieldRaw>

export interface LoadSchemaParams {
  iblockTypeId: string
  iblockId: number
}

export interface B24ListSchema {
  getFieldId: (xmlCode: string) => string
  getEnumId: (xmlCode: string, enumXmlCode: string) => string
}

/**
 * Maps symbolic enum codes (XML_ID) to the exact Russian labels configured in
 * Bitrix24 for the payments list. Needed because `lists.field.get` only
 * exposes display labels — XML_IDs of enum values are not returned.
 *
 * Keep in sync with the list configuration in Bitrix24.
 */
const ENUM_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
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
}

const fieldIdByCode = new Map<string, string>()
const enumIdByCode = new Map<string, Map<string, string>>()
let loaded = false
let loadingPromise: Promise<void> | null = null

function normalizeKey(code: string): string {
  return code.trim().toUpperCase()
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase()
}

function buildEnumMap(fieldCode: string, displayValues: Record<string, string>): Map<string, string> | null {
  const labels = ENUM_LABELS[fieldCode]
  if (!labels) {
    return null
  }

  const labelToId = new Map<string, string>()
  for (const [id, label] of Object.entries(displayValues)) {
    if (typeof label !== 'string') {
      continue
    }
    labelToId.set(normalizeLabel(label), String(id))
  }

  const result = new Map<string, string>()
  for (const [xmlCode, expectedLabel] of Object.entries(labels)) {
    const id = labelToId.get(normalizeLabel(expectedLabel))
    if (id) {
      result.set(normalizeKey(xmlCode), id)
    }
  }

  return result.size > 0 ? result : null
}

function parseFields(result: B24ListFieldResponse): void {
  fieldIdByCode.clear()
  enumIdByCode.clear()

  for (const entry of Object.values(result)) {
    const rawCode = entry.CODE ? String(entry.CODE) : ''
    if (!rawCode) {
      continue
    }

    const fieldId = entry.FIELD_ID ? String(entry.FIELD_ID) : entry.ID ? `PROPERTY_${entry.ID}` : ''
    if (!fieldId) {
      continue
    }

    const codeKey = normalizeKey(rawCode)
    fieldIdByCode.set(codeKey, fieldId)

    if (entry.DISPLAY_VALUES_FORM && typeof entry.DISPLAY_VALUES_FORM === 'object') {
      const enumMap = buildEnumMap(codeKey, entry.DISPLAY_VALUES_FORM)
      if (enumMap) {
        enumIdByCode.set(codeKey, enumMap)
      }
    }
  }
}

async function fetchSchema(b24: TypeB24, params: LoadSchemaParams): Promise<void> {
  const response = await b24.actions.v2.call.make<B24ListFieldResponse>({
    method: 'lists.field.get',
    params: {
      IBLOCK_TYPE_ID: params.iblockTypeId,
      IBLOCK_ID: params.iblockId
    },
    requestId: `lists.field.get:${params.iblockTypeId}:${params.iblockId}`
  })

  if (!response.isSuccess) {
    throw new Error(`lists.field.get: ${response.getErrorMessages().join('; ')}`)
  }

  const result = response.getData()?.result
  if (!result || typeof result !== 'object') {
    throw new Error('lists.field.get: пустой ответ сервера')
  }

  console.log('result', result)

  parseFields(result as B24ListFieldResponse)
  loaded = true
}

export const useB24ListSchema = () => {
  async function load(b24: TypeB24, params: LoadSchemaParams): Promise<void> {
    if (loaded) {
      return
    }
    if (loadingPromise) {
      return loadingPromise
    }

    loadingPromise = fetchSchema(b24, params).finally(() => {
      loadingPromise = null
    })
    return loadingPromise
  }

  function assertLoaded(): void {
    if (!loaded) {
      throw new Error('Схема списка Bitrix24 не загружена — вызовите load() перед использованием')
    }
  }

  function getFieldId(xmlCode: string): string {
    assertLoaded()
    const id = fieldIdByCode.get(normalizeKey(xmlCode))
    if (!id) {
      throw new Error(`Поле с кодом «${xmlCode}» не найдено в списке Bitrix24`)
    }
    return id
  }

  function getEnumId(xmlCode: string, enumXmlCode: string): string {
    assertLoaded()
    const values = enumIdByCode.get(normalizeKey(xmlCode))
    if (!values) {
      throw new Error(`Поле «${xmlCode}» не является списком или не содержит значений`)
    }
    const enumId = values.get(normalizeKey(enumXmlCode))
    if (!enumId) {
      throw new Error(`Значение «${enumXmlCode}» не найдено в поле «${xmlCode}»`)
    }
    return enumId
  }

  function validateCodes(
    requiredFields: readonly string[],
    requiredEnums: Readonly<Record<string, readonly string[]>>
  ): string[] {
    const missing: string[] = []

    for (const code of requiredFields) {
      if (!fieldIdByCode.has(normalizeKey(code))) {
        missing.push(code)
      }
    }

    for (const [fieldCode, enumCodes] of Object.entries(requiredEnums)) {
      const values = enumIdByCode.get(normalizeKey(fieldCode))
      if (!values) {
        missing.push(`${fieldCode} (значения списка)`)
        continue
      }
      for (const enumCode of enumCodes) {
        if (!values.has(normalizeKey(enumCode))) {
          missing.push(`${fieldCode}.${enumCode}`)
        }
      }
    }

    return missing
  }

  function reset(): void {
    fieldIdByCode.clear()
    enumIdByCode.clear()
    loaded = false
    loadingPromise = null
  }

  const isLoaded = () => loaded

  function getKnownFieldCodes(): string[] {
    return [...fieldIdByCode.keys()].sort()
  }

  return {
    load,
    getFieldId,
    getEnumId,
    validateCodes,
    reset,
    isLoaded,
    getKnownFieldCodes
  }
}
