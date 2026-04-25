import { Buffer } from 'buffer'
import { computed, reactive, ref } from 'vue'
import MD5 from 'crypto-js/md5'
import * as iconv from 'iconv-lite'
import CircleCheckIcon from '@bitrix24/b24icons-vue/outline/CircleCheckIcon'
import type { TypeB24 } from '@bitrix24/b24jssdk'
import {
  CURRENCY_MAP,
  CSV_DEFAULT_CURRENCY,
  CSV_DOCUMENT_TITLE,
  CSV_IMPORT_TITLE,
  DEFAULT_CURRENCY,
  FILE_SIGNATURE_1C,
  FILE_SIGNATURE_CLIENT_BANK
} from '~/constants/clbank'
import {
  B24_CURRENCY_BYN,
  B24_IMPORT_ELEMENT_TEXT,
  B24_IMPORT_ENUM,
  B24_IMPORT_SYS_INFO_MARKER,
  B24_LIST_REQUIRED_ENUMS,
  B24_LIST_REQUIRED_FIELD_CODES
} from '~/constants/b24List'
import { useB24 } from '~/composables/useB24'
import { useB24ListConfig } from '~/composables/useB24ListConfig'
import { useB24ListSchema } from '~/composables/useB24ListSchema'
import { Parser, ParserTxtFile } from '~/composables/useParser'
import type {
  BankOperation,
  ClBankItemRow,
  ClBankParsedResult,
  CompanyStatement,
  CsvRow,
  ImportStatus
} from '~/types/bank-statement'
import { getErrorMessage } from '~/utils/error'
import {
  hasRecords,
  parseAmount,
  parseIntSafe,
  stripBom
} from '~/utils/index'
import { parseBankCsv } from '~/utils/csv'

type CurrencyCode = keyof typeof CURRENCY_MAP

export const useClBankImportPage = () => {
  const toast = useToast()
  const b24Instance = useB24()
  const listConfig = useB24ListConfig()
  const schema = useB24ListSchema()
  const isUseB24 = computed(() => b24Instance.isInit())

  const file = ref<File | null>(null)
  const isParsing = ref(false)
  const isImporting = ref(false)
  const errorContainer = ref<string | null>(null)

  const myCompany = reactive<CompanyStatement>({
    title: '',
    accNumber: null,
    currency: {
      code: '',
      number: 0
    },
    currCode: null,
    type: 0,
    bankName: '',
    document: {
      title: ''
    },
    in: [],
    out: []
  })

  const importStatus = reactive<ImportStatus>({
    isProcessing: false,
    processed: 0,
    total: 0,
    errors: []
  })

  async function onFileSelect(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement
    if (!target.files || target.files.length === 0) {
      return
    }

    file.value = target.files[0] ?? null
    errorContainer.value = null
    await processFile()
  }

  async function decodeFile(content: ArrayBuffer): Promise<string> {
    try {
      const buffer = Buffer.from(new Uint8Array(content))
      return iconv.decode(buffer, 'win1251')
    } catch {
      return new TextDecoder('utf-8').decode(content)
    }
  }

  function resolveCurrency(currencyCodeRaw: string | undefined): { code: CurrencyCode, number: number } {
    if (!currencyCodeRaw) {
      return DEFAULT_CURRENCY
    }

    const normalizedCode = currencyCodeRaw.toUpperCase()
    if (normalizedCode in CURRENCY_MAP) {
      const code = normalizedCode as CurrencyCode
      return { code, number: CURRENCY_MAP[code] }
    }

    const numericCode = parseIntSafe(currencyCodeRaw)
    for (const [code, number] of Object.entries(CURRENCY_MAP) as [CurrencyCode, number][]) {
      if (number === numericCode) {
        return { code, number }
      }
    }

    return DEFAULT_CURRENCY
  }

  async function processFile(): Promise<void> {
    if (!file.value) {
      return
    }

    isParsing.value = true
    clearCompanyData()

    try {
      const arrayBuffer = await file.value.arrayBuffer()
      const content = stripBom((await decodeFile(arrayBuffer)).trimStart())

      if (content.startsWith(FILE_SIGNATURE_1C)) {
        // Формат распознаётся, но маппинг операций пока не реализован.
        new Parser(content, 'UTF-8')
        toast.add({
          title: 'Формат 1C пока не поддерживается',
          description: 'Используйте выгрузку из клиент-банка',
          color: 'air-primary-alert',
          icon: CircleCheckIcon
        })
        return
      }

      if (content.startsWith(FILE_SIGNATURE_CLIENT_BANK)) {
        const parser = new ParserTxtFile(content, 'UTF-8')
        const parsedData = parser.getResult() as ClBankParsedResult
        processMapping(parsedData)

        const opCount = myCompany.in.length + myCompany.out.length
        if (opCount === 0) {
          toast.add({
            title: 'Файл обработан',
            description: 'Операции в файле не найдены. Проверьте наличие проводок в разделе выписки.',
            color: 'air-primary-warning',
            icon: CircleCheckIcon
          })
        } else {
          toast.add({
            title: 'Файл успешно обработан',
            description: `Найдено ${opCount} операций`,
            color: 'air-primary-success',
            icon: CircleCheckIcon
          })
        }
        return
      }

      // Формат не определён по сигнатуре — пробуем разобрать как CSV.
      // Используем уже раскодированный content (win1251 → utf-8), чтобы корректно
      // обрабатывать файлы в обеих кодировках.
      const csvOutcome = parseBankCsv(content)
      if (csvOutcome.kind === 'unknown_format') {
        throw new Error(
          'Неизвестный формат файла. Ожидается выгрузка клиент-банка (строка начинается с ***** ^Type=), формат 1C или CSV с колонками: дата, сумма, описание, контрагент.'
        )
      }
      if (csvOutcome.kind === 'header_only') {
        toast.add({
          title: 'Файл обработан',
          description: 'Операции в файле не найдены (обнаружена только строка заголовка).',
          color: 'air-primary-warning',
          icon: CircleCheckIcon
        })
        return
      }

      convertCSVToOperations(csvOutcome.rows)
      toast.add({
        title: 'CSV файл обработан',
        description: `Найдено ${csvOutcome.rows.length} записей`,
        color: 'air-primary-success',
        icon: CircleCheckIcon
      })
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      console.error('Ошибка при обработке файла:', error)
      errorContainer.value = `Ошибка при обработке файла: ${message}`
      toast.add({
        title: 'Ошибка обработки файла',
        description: message,
        color: 'air-primary-alert',
        icon: CircleCheckIcon
      })
    } finally {
      isParsing.value = false
    }
  }

  function processMapping(parsedData: ClBankParsedResult): void {
    const header = parsedData.OUT_PARAM?.header
    myCompany.title = header?.Header5 ?? ''
    myCompany.document.title = header?.Header1 ?? ''
    myCompany.accNumber = parsedData.GENERAL.ACC ?? null
    myCompany.type = parseIntSafe(parsedData.GENERAL.TYPE)

    const currency = resolveCurrency(parsedData.OUT_PARAM?.wtf?.I3)
    myCompany.currency.number = currency.number
    myCompany.currency.code = currency.code

    myCompany.bankName = parsedData.OUT_PARAM?.wtf?.MyBankName ?? ''
    myCompany.title = myCompany.title
      .replaceAll('*', ' ')
      .replace('Наименование счета', ' ')
      .replace('Наименование', ' ')
      .trim()

    for (const row of parsedData.OUT_PARAM?.items ?? []) {
      parseRow(row)
    }
  }

  function parseRow(row: ClBankItemRow): void {
    const operation: BankOperation = {
      document: {
        num: row.Num ?? '',
        date: row.DocDate ?? '',
        time: row.DocTime ?? ''
      },
      operation: {
        date: row.OpDate ?? '',
        time: row.OpTime ?? '',
        description: [row.Nazn ?? '', row.Nazn2 ?? ''].join(' ').trim(),
        sum: 0,
        isIn: false
      },
      client: {
        name: row.KorName ?? '',
        unn: row.UNNRec ?? '',
        unp: row.KorUNP ?? '',
        accNumber: row.Acc ?? ''
      },
      importStatus: null
    }

    const debit = parseAmount(row.Db) || parseAmount(row.DebQ) || parseAmount(row.Deb)
    const credit = parseAmount(row.Credit) || parseAmount(row.CreQ) || parseAmount(row.Cre)

    if (debit > 0) {
      operation.operation.isIn = false
      operation.operation.sum = debit
      myCompany.out.push(operation)
      return
    }

    operation.operation.isIn = true
    operation.operation.sum = credit
    myCompany.in.push(operation)
  }

  function convertCSVToOperations(csvData: CsvRow[]): void {
    for (const item of csvData) {
      const isIn = item.amount >= 0
      const operation: BankOperation = {
        document: {
          num: String(item.id),
          date: item.date,
          time: ''
        },
        operation: {
          date: item.date,
          time: '',
          description: item.description,
          sum: Math.abs(item.amount),
          isIn
        },
        client: {
          name: item.contractor,
          unn: '',
          unp: '',
          accNumber: ''
        },
        importStatus: null
      }

      if (isIn) {
        myCompany.in.push(operation)
      } else {
        myCompany.out.push(operation)
      }
    }

    myCompany.title = CSV_IMPORT_TITLE
    myCompany.document.title = CSV_DOCUMENT_TITLE
    myCompany.currency.code = CSV_DEFAULT_CURRENCY
    myCompany.currency.number = CURRENCY_MAP.RUB
  }

  function clearCompanyData(): void {
    myCompany.title = ''
    myCompany.accNumber = null
    myCompany.currency.code = ''
    myCompany.currency.number = 0
    myCompany.currCode = null
    myCompany.type = 0
    myCompany.bankName = ''
    myCompany.document.title = ''
    myCompany.in = []
    myCompany.out = []
  }

  async function importToBitrix24(): Promise<void> {
    if (myCompany.in.length + myCompany.out.length === 0) {
      return
    }

    if (!isUseB24.value) {
      toast.add({
        title: 'Bitrix24 не инициализирован',
        description: 'Приложение должно быть запущено внутри Bitrix24',
        color: 'air-primary-alert',
        icon: CircleCheckIcon
      })
      return
    }

    const b24 = b24Instance.get()
    if (!b24) {
      toast.add({
        title: 'Ошибка подключения',
        description: 'Не удалось получить экземпляр Bitrix24',
        color: 'air-primary-alert',
        icon: CircleCheckIcon
      })
      return
    }

    isImporting.value = true
    importStatus.isProcessing = true
    importStatus.processed = 0
    importStatus.total = myCompany.in.length + myCompany.out.length
    importStatus.errors = []

    try {
      try {
        await schema.load(b24, {
          iblockTypeId: listConfig.iblockTypeId,
          iblockId: listConfig.iblockId
        })
      } catch (error: unknown) {
        const message = getErrorMessage(error)
        errorContainer.value = `Не удалось загрузить схему списка Bitrix24: ${message}`
        throw error
      }

      const missing = schema.validateCodes(B24_LIST_REQUIRED_FIELD_CODES, B24_LIST_REQUIRED_ENUMS)
      if (missing.length > 0) {
        const message = `В списке Bitrix24 не хватает полей/значений: ${missing.join(', ')}`
        errorContainer.value = message
        throw new Error(message)
      }

      const allOperations = [...myCompany.in, ...myCompany.out]
      for (const operation of allOperations) {
        try {
          await processRow(operation, b24)
          importStatus.processed++
        } catch (error: unknown) {
          const message = getErrorMessage(error)
          importStatus.errors.push(`Операция ${operation.document.num}: ${message}`)
        }
      }

      if (importStatus.errors.length === 0) {
        toast.add({
          title: 'Импорт завершен успешно',
          description: `Импортировано ${importStatus.processed} операций`,
          color: 'air-primary-success',
          icon: CircleCheckIcon
        })
      } else {
        toast.add({
          title: 'Импорт завершен с ошибками',
          description: `Успешно: ${importStatus.processed}, ошибок: ${importStatus.errors.length}`,
          color: 'air-primary-warning',
          icon: CircleCheckIcon
        })
      }
    } catch (error: unknown) {
      toast.add({
        title: 'Ошибка импорта',
        description: getErrorMessage(error),
        color: 'air-primary-alert',
        icon: CircleCheckIcon
      })
    } finally {
      isImporting.value = false
      importStatus.isProcessing = false
    }
  }

  async function processRow(row: BankOperation, b24: TypeB24): Promise<void> {
    const rowHash = MD5([
      row.client.accNumber,
      row.document.num,
      row.operation.date,
      row.operation.sum,
      myCompany.currency.code
    ].join('-')).toString()

    const checkResponse = await b24.actions.v2.call.make({
      method: 'lists.element.get',
      params: {
        IBLOCK_TYPE_ID: listConfig.iblockTypeId,
        IBLOCK_ID: listConfig.iblockId,
        ELEMENT_CODE: rowHash
      },
      requestId: `lists.element.get:${rowHash}`
    })

    if (!checkResponse.isSuccess) {
      throw new Error(checkResponse.getErrorMessages().join('; '))
    }

    const existing = checkResponse.getData()?.result
    if (hasRecords(existing)) {
      row.importStatus = { isSuccess: false, message: 'Запись уже импортирована' }
      throw new Error('Эта запись была ранее импортирована')
    }

    const createResponse = await b24.actions.v2.call.make({
      method: 'lists.element.add',
      params: {
        IBLOCK_TYPE_ID: listConfig.iblockTypeId,
        IBLOCK_ID: listConfig.iblockId,
        ELEMENT_CODE: rowHash,
        FIELDS: buildElementFields(row)
      },
      requestId: `lists.element.add:${rowHash}`
    })

    if (!createResponse.isSuccess) {
      throw new Error(createResponse.getErrorMessages().join('; '))
    }

    row.importStatus = {
      isSuccess: true,
      result: createResponse.getData()?.result
    }
  }

  function buildElementFields(row: BankOperation): Record<string, unknown> {
    const f = schema.getFieldId
    const e = schema.getEnumId
    const isIn = row.operation.isIn
    const currencyCode = myCompany.currency.code
    const docDateTime = [row.document.date, row.document.time].filter(Boolean).join(' ')

    const t = B24_IMPORT_ELEMENT_TEXT
    const en = B24_IMPORT_ENUM
    return {
      NAME: `${isIn ? t.nameIn : t.nameOut} ${row.client.name}${t.nameSuffix}${docDateTime}`.trim(),
      DETAIL_TEXT: `${t.detailTextPrefix}${row.operation.description}\n\n${row.client.name}${t.detailTextUnpLabel}${row.client.unp}`,
      [f('STATUS')]: e('STATUS', en.STATUS.PAID),
      [f('STATUS_PROCESS')]: e('STATUS_PROCESS', en.STATUS_PROCESS.PROCESS),
      [f('DOC_NUM')]: row.document.num,
      [f('DOC_DATE_TIME')]: docDateTime,
      [f('CATEGORY')]: e('CATEGORY', isIn ? en.CATEGORY.IN : en.CATEGORY.OUT),
      [f('METHOD')]: e('METHOD', en.METHOD.CASHLESS),
      [f('TYPE')]: e('TYPE', en.TYPE.FULLPAY),
      [f('SUM')]: `${row.operation.sum}|${currencyCode}`,
      [f('BASE_SUM')]: currencyCode === B24_CURRENCY_BYN ? row.operation.sum : 0,
      [f('MY_COMPANY_LST_RQ')]: listConfig.myCompanyId,
      [f('MY_COMPANY_BANK_ACCNUM')]: myCompany.accNumber ?? '',
      [f('CLIENT_BANK_ACCNUM')]: row.client.accNumber,
      [f('ARTICLE')]: isIn ? listConfig.articleIdIn : listConfig.articleIdOut,
      [f('SYS_INFO')]: B24_IMPORT_SYS_INFO_MARKER
    }
  }

  function resetForm(): void {
    file.value = null
    errorContainer.value = null
    clearCompanyData()
    importStatus.processed = 0
    importStatus.total = 0
    importStatus.errors = []
  }

  const hasFile = computed(() => !!file.value)
  const hasOperations = computed(() => myCompany.in.length + myCompany.out.length > 0)
  const sumIn = computed(() => myCompany.in.reduce((sum, row) => sum + row.operation.sum, 0))
  const sumOut = computed(() => myCompany.out.reduce((sum, row) => sum + row.operation.sum, 0))
  const totalOperations = computed(() => myCompany.in.length + myCompany.out.length)
  const footerYear = new Date().getFullYear()

  return {
    file,
    isParsing,
    isImporting,
    errorContainer,
    myCompany,
    importStatus,
    isUseB24,
    hasFile,
    hasOperations,
    sumIn,
    sumOut,
    totalOperations,
    footerYear,
    onFileSelect,
    importToBitrix24,
    resetForm
  }
}
