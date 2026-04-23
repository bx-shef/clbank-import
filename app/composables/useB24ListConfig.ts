/**
 * Provides Bitrix24 universal-list configuration.
 *
 * All values are sourced from Nuxt runtimeConfig.public.b24 and can be overridden
 * per environment via NUXT_PUBLIC_B24_* variables (see .env.example).
 *
 * Field IDs are stored as raw numeric property IDs (e.g. "175"); the "PROPERTY_"
 * prefix that Bitrix24 REST expects is added here, so consumers receive ready-to-use
 * keys like "PROPERTY_175".
 */

type FieldKey
  = | 'paymentType'
    | 'amount'
    | 'currency'
    | 'operationDate'
    | 'docNumber'
    | 'ourAcc'
    | 'clientAcc'
    | 'clientName'
    | 'clientUnp'
    | 'description'
    | 'hashId'
    | 'category'
    | 'method'
    | 'docDateTime'

export type B24FieldMap = Record<FieldKey, string>

export interface B24ListConfig {
  iblockTypeId: string
  iblockId: number
  fieldMap: B24FieldMap
  paymentCategoryIn: string
  paymentCategoryOut: string
  paymentTypeFull: string
  paymentMethodNonCash: string
}

const PROPERTY_PREFIX = 'PROPERTY_'

function toPropertyKey(rawId: string | number): string {
  const value = String(rawId).trim()
  if (!value) {
    throw new Error('Bitrix24 list field id is not configured')
  }

  return value.startsWith(PROPERTY_PREFIX) ? value : `${PROPERTY_PREFIX}${value}`
}

export const useB24ListConfig = (): B24ListConfig => {
  const { b24 } = useRuntimeConfig().public

  const fieldMap = {
    paymentType: toPropertyKey(b24.field.paymentType),
    amount: toPropertyKey(b24.field.amount),
    currency: toPropertyKey(b24.field.currency),
    operationDate: toPropertyKey(b24.field.operationDate),
    docNumber: toPropertyKey(b24.field.docNumber),
    ourAcc: toPropertyKey(b24.field.ourAcc),
    clientAcc: toPropertyKey(b24.field.clientAcc),
    clientName: toPropertyKey(b24.field.clientName),
    clientUnp: toPropertyKey(b24.field.clientUnp),
    description: toPropertyKey(b24.field.description),
    hashId: toPropertyKey(b24.field.hashId),
    category: toPropertyKey(b24.field.category),
    method: toPropertyKey(b24.field.method),
    docDateTime: toPropertyKey(b24.field.docDateTime)
  } satisfies B24FieldMap

  return {
    iblockTypeId: b24.iblockTypeId,
    iblockId: Number(b24.iblockId),
    fieldMap,
    paymentCategoryIn: b24.paymentCategoryIn,
    paymentCategoryOut: b24.paymentCategoryOut,
    paymentTypeFull: b24.paymentTypeFull,
    paymentMethodNonCash: b24.paymentMethodNonCash
  }
}
