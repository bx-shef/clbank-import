import type { CsvParseOutcome, CsvRow } from '~/types/bank-statement'
import { parseAmount } from '~/utils/index'

/** Дата в форматах выгрузок: DD.MM.YYYY, DD/MM/YYYY или YYYY-MM-DD */
export function looksLikeBankDate(value: string): boolean {
  const s = value.trim().replace(/^"|"$/g, '')
  if (!s) {
    return false
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return true
  }
  return /^\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(s)
}

/** Сумма: целое или дробное, запятая или точка, опциональный минус, пробелы как разделители групп */
export function looksLikeAmountCell(value: string): boolean {
  const s = value.trim().replace(/^"|"$/g, '').replaceAll(/\s/g, '')
  if (!s) {
    return false
  }
  return /^-?\d+([.,]\d+)?$/.test(s)
}

/**
 * Эвристика: строка скорее всего является заголовком CSV,
 * если содержит типичные слова-заголовки колонок выписки.
 */
export function isProbablyCsvHeaderRow(parts: string[]): boolean {
  if (parts.length < 2) {
    return false
  }
  const joined = parts.join(' ')
  return /дата|date|сумма|sum|amount|описание|description|назначение|контрагент|counterparty|плательщик/i.test(joined)
}

/**
 * Разбирает текст как CSV-выписку банка.
 *
 * Ожидаемый порядок колонок: дата | сумма | описание | контрагент.
 * Поддерживаемые разделители: `;`, `,`, `\t`.
 * Строка заголовка (если есть) пропускается автоматически.
 *
 * Возвращает:
 * - `ok` + распознанные строки, если найдены операции;
 * - `header_only`, если найдена только строка заголовка без данных;
 * - `unknown_format`, если формат не похож на ожидаемую выписку.
 */
export function parseBankCsv(text: string): CsvParseOutcome {
  const lines = text.split(/\r?\n/).map(l => l.trimEnd()).filter(line => line.trim() !== '')
  if (lines.length === 0) {
    return { kind: 'unknown_format' }
  }

  const sampleLine = lines.find(l => l.includes(';') || l.includes(',') || l.includes('\t')) ?? (lines[0] ?? '')
  let delimiter = ','
  if (sampleLine.includes(';')) {
    delimiter = ';'
  } else if (sampleLine.includes('\t')) {
    delimiter = '\t'
  }

  const splitLine = (line: string): string[] =>
    line.split(delimiter).map(part => part.trim().replace(/^"|"$/g, ''))

  const rowLooksValid = (parts: string[]): boolean =>
    looksLikeBankDate(parts[0] ?? '') && looksLikeAmountCell(parts[1] ?? '')

  const firstParts = splitLine(lines[0] ?? '')
  const firstIsDataRow = rowLooksValid(firstParts)

  if (lines.length === 1 && !firstIsDataRow) {
    return isProbablyCsvHeaderRow(firstParts) ? { kind: 'header_only' } : { kind: 'unknown_format' }
  }

  let startIndex = 0
  if (!firstIsDataRow && lines.length > 1) {
    const secondParts = splitLine(lines[1] ?? '')
    if (rowLooksValid(secondParts)) {
      startIndex = 1
    }
  }

  const result: CsvRow[] = []
  for (let index = startIndex; index < lines.length; index++) {
    const parts = splitLine(lines[index] ?? '')
    if (!rowLooksValid(parts)) {
      continue
    }

    result.push({
      id: result.length + 1,
      date: parts[0] ?? '',
      amount: parseAmount(parts[1]),
      description: parts[2] ?? '',
      contractor: parts[3] ?? ''
    })
  }

  if (result.length === 0) {
    return { kind: 'unknown_format' }
  }
  return { kind: 'ok', rows: result }
}
