export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomFrom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]!
}

/**
 * Pause on xxx milliseconds
 *
 * @return {Promise<void>}
 * @constructor
 */
export async function sleepAction(timeout: number = 1000): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, timeout))
}

export function parseAmount(value: string | undefined): number {
  if (!value) {
    return 0
  }
  const normalized = value.replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function parseIntSafe(value: string | undefined): number {
  if (!value) {
    return 0
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Strips the UTF-8 BOM character (U+FEFF) from the start of a string if present. */
export function stripBom(text: string): string {
  return text.length > 0 && text.codePointAt(0) === 0xfeff ? text.slice(1) : text
}

export function hasRecords(result: unknown): boolean {
  return !!result && typeof result === 'object' && Object.keys(result as Record<string, unknown>).length > 0
}
