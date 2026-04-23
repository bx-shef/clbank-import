/**
 * Static Bitrix24 universal-list configuration.
 *
 * Only identifiers that cannot be resolved at runtime live here:
 * - list/iblock identifiers (IBLOCK_TYPE_ID, IBLOCK_ID);
 * - reference element IDs that point to other lists (MyCompany, Article).
 *
 * Property IDs (PROPERTY_<n>) and enum value IDs are resolved from
 * `lists.field.get` via `useB24ListSchema`.
 */

export interface B24ListConfig {
  iblockTypeId: string
  iblockId: number
  myCompanyId: number
  articleIdIn: number
  articleIdOut: number
}

function toNumber(value: unknown, field: string): number {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`Bitrix24 config: значение «${field}» должно быть положительным числом`)
  }
  return num
}

export const useB24ListConfig = (): B24ListConfig => {
  const { b24 } = useRuntimeConfig().public

  return {
    iblockTypeId: String(b24.iblockTypeId || 'lists'),
    iblockId: toNumber(b24.iblockId, 'iblockId'),
    myCompanyId: toNumber(b24.myCompanyId, 'myCompanyId'),
    articleIdIn: toNumber(b24.articleIdIn, 'articleIdIn'),
    articleIdOut: toNumber(b24.articleIdOut, 'articleIdOut')
  }
}
