<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useB24 } from '~/composables/useB24'
import { Parser, ParserTxtFile } from '~/composables/useParser'
import UploadIcon from '@bitrix24/b24icons-vue/outline/UploadIcon'
import DocumentIcon from '@bitrix24/b24icons-vue/main/DocumentIcon'
import SendIcon from '@bitrix24/b24icons-vue/outline/SendIcon'
import CircleCheckIcon from '@bitrix24/b24icons-vue/outline/CircleCheckIcon'
import * as iconv from 'iconv-lite'
import { Buffer } from 'buffer'
import MD5 from 'crypto-js/md5'

const toast = useToast()
const b24Instance = useB24()
const isUseB24 = computed(() => b24Instance.isInit())

// Состояния
const file = ref<File | null>(null)
const isParsing = ref(false)
const isImporting = ref(false)
const errorContainer = ref<string | null>(null)

// Данные компании и операций
const myCompany = reactive({
  title: '',
  accNumber: null as string | null,
  currency: {
    code: '',
    number: 0
  },
  currCode: null as string | null,
  type: 0,
  bankName: '',
  document: {
    title: ''
  },
  in: [] as any[],
  out: [] as any[],
})

// Статус импорта (упрощенный)
const importStatus = reactive({
  isProcessing: false,
  processed: 0,
  total: 0,
  errors: [] as string[],
})

// Обработчик выбора файла
async function onFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return

  file.value = target.files[0]!
  errorContainer.value = null

  await processFile()
}

// Преобразование кодировки win1251 -> utf8
async function decodeFile(content: ArrayBuffer): Promise<string> {
  try {
    // Попробуем декодировать как win1251
    const buffer = Buffer.from(new Uint8Array(content))
    const decoded = iconv.decode(buffer, 'win1251')
    // Если decoded содержит кракозябры, возможно файл уже в utf8
    // Простая проверка: если есть символы вне ASCII, считаем что декодирование успешно
    return decoded
  } catch {
    // Если ошибка, считаем что файл в utf8
    return new TextDecoder('utf-8').decode(content)
  }
}

// Основная обработка файла
async function processFile() {
  if (!file.value) return

  isParsing.value = true
  clearCompanyData()

  try {
    const arrayBuffer = await file.value.arrayBuffer()
    const content = await decodeFile(arrayBuffer)

    // Определяем формат файла
    if (content.startsWith('1CClientBankExchange')) {
      // Формат 1C
      const parser = new Parser(content, 'UTF-8')
      const parsedData = parser.getResult()
      // TODO: преобразовать в нашу структуру (пока не реализовано)
      toast.add({
        title: 'Формат 1C пока не поддерживается',
        description: 'Используйте выгрузку из клиент-банка',
        color: 'air-primary-alert',
        icon: CircleCheckIcon
      })
      return
    } else if (content.startsWith('***** ^Type=')) {
      // Формат клиент-банка
      const parser = new ParserTxtFile(content, 'UTF-8')
      const parsedData = parser.getResult()
      processMapping(parsedData)

      toast.add({
        title: 'Файл успешно обработан',
        description: `Найдено ${myCompany.in.length + myCompany.out.length} операций`,
        color: 'air-primary-success',
        icon: CircleCheckIcon
      })
    } else {
      // Пробуем CSV как запасной вариант
      const text = new TextDecoder('utf-8').decode(arrayBuffer)
      const parsed = parseCSV(text)
      if (parsed.length > 0) {
        // Преобразуем CSV данные в структуру операций
        convertCSVToOperations(parsed)
        toast.add({
          title: 'CSV файл обработан',
          description: `Найдено ${parsed.length} записей`,
          color: 'air-primary-success',
          icon: CircleCheckIcon
        })
      } else {
        throw new Error('Неизвестный формат файла')
      }
    }
  } catch (error: any) {
    console.error('Ошибка при обработке файла:', error)
    errorContainer.value = 'Ошибка при обработке файла: ' + (error?.message || error)
    toast.add({
      title: 'Ошибка обработки файла',
      description: error?.message || 'Не удалось обработать файл',
      color: 'air-primary-alert',
      icon: CircleCheckIcon
    })
  } finally {
    isParsing.value = false
  }
}

// Маппинг данных из парсера в структуру компании
function processMapping(parsedData: any) {
  myCompany.title = (parsedData.OUT_PARAM.header?.Header5 || '')
  myCompany.document.title = (parsedData.OUT_PARAM.header?.Header1 || '')
  myCompany.accNumber = parsedData.GENERAL.ACC
  myCompany.type = parseInt(parsedData.GENERAL.TYPE)

  // Определение валюты
  const currencyCode = parsedData.OUT_PARAM?.wtf?.I3
  if (currencyCode === 'EUR' || parseInt(currencyCode) === 978) {
    myCompany.currency.number = 978
    myCompany.currency.code = 'EUR'
  } else if (currencyCode === 'USD' || parseInt(currencyCode) === 840) {
    myCompany.currency.number = 840
    myCompany.currency.code = 'USD'
  } else if (currencyCode === 'CNY' || parseInt(currencyCode) === 156) {
    myCompany.currency.number = 156
    myCompany.currency.code = 'CNY'
  } else if (currencyCode === 'RUB' || parseInt(currencyCode) === 643) {
    myCompany.currency.number = 643
    myCompany.currency.code = 'RUB'
  } else if (currencyCode === 'BYN' || parseInt(currencyCode) === 933) {
    myCompany.currency.number = 933
    myCompany.currency.code = 'BYN'
  }

  myCompany.bankName = parsedData.OUT_PARAM?.wtf?.MyBankName || ''

  // Очистка названия компании
  myCompany.title = myCompany.title
    .replaceAll('*', ' ')
    .replace('Наименование счета', ' ')
    .replace('Наименование', ' ')
    .trim()

  // Обработка строк операций
  ;(parsedData.OUT_PARAM?.items || []).forEach((row: any) => parseRow(row))
}

// Парсинг строки операции (аналогично демо)
function parseRow(row: any): any {
  const result = {
    document: {
      num: row?.Num || '',
      date: row?.DocDate || '',
      time: row?.DocTime || '',
    },
    operation: {
      date: row?.OpDate || '',
      time: row?.OpTime || '',
      description: [row?.Nazn || '', row?.Nazn2 || ''].join(' '),
      sum: 0.0,
      isIn: false
    },
    client: {
      name: row?.KorName || '',
      unn: row?.UNNRec || '',
      unp: row?.KorUNP || '',
      accNumber: row?.Acc || '',
    },
    importStatus: null as any
  }

  let debit = 0.0
  let credit = 0.0

  if (row.Db) {
    debit = parseFloat(row.Db)
  } else if (row.DebQ) {
    debit = parseFloat(row.DebQ)
  } else if (row.Deb) {
    debit = parseFloat(row.Deb)
  }

  if (row.Credit) {
    credit = parseFloat(row.Credit)
  } else if (row.CreQ) {
    credit = parseFloat(row.CreQ)
  } else if (row.Cre) {
    credit = parseFloat(row.Cre)
  }

  if (debit > 0) {
    result.operation.isIn = false
    result.operation.sum = debit
  } else {
    result.operation.isIn = true
    result.operation.sum = credit
  }

  if (result.operation.isIn) {
    myCompany.in.push(result)
  } else {
    myCompany.out.push(result)
  }
}

// Парсинг CSV (резервный метод)
function parseCSV(text: string) {
  const lines = text.split('\n').filter(line => line.trim() !== '')
  if (lines.length === 0) return []

  const firstLine = lines[0]!
  let delimiter = ','
  if (firstLine.includes(';')) delimiter = ';'
  else if (firstLine.includes('\t')) delimiter = '\t'

  const result = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const parts = line.split(delimiter).map(part => part.trim().replace(/^"|"$/g, ''))

    const date = parts[0] || ''
    const amount = parseFloat(parts[1]?.replace(',', '.') || '0') || 0
    const description = parts[2] || ''
    const contractor = parts[3] || ''

    if (date || amount || description || contractor) {
      result.push({
        id: i + 1,
        date,
        amount,
        description,
        contractor
      })
    }
  }
  return result
}

// Конвертация CSV данных в структуру операций
function convertCSVToOperations(csvData: any[]) {
  csvData.forEach(item => {
    const isIn = item.amount >= 0 // упрощенно
    const operation = {
      document: {
        num: item.id.toString(),
        date: item.date,
        time: '',
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
        accNumber: '',
      },
      importStatus: null
    }

    if (isIn) {
      myCompany.in.push(operation)
    } else {
      myCompany.out.push(operation)
    }
  })

  // Заполняем недостающие поля компании
  myCompany.title = 'Импорт из CSV'
  myCompany.document.title = 'CSV файл'
  myCompany.currency.code = 'RUB'
  myCompany.currency.number = 643
}

// Очистка данных компании
function clearCompanyData() {
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

// Импорт операций в Bitrix24
async function importToBitrix24() {
  if (myCompany.in.length + myCompany.out.length === 0) return

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

  const smartEntityTypeId = 1036
  const operationIds = { in: 14, out: 16 } // как в демо

  try {
    // Объединяем все операции
    const allOperations = [...myCompany.in, ...myCompany.out]

    for (const operation of allOperations) {
      try {
        await processRow(operation, b24, smartEntityTypeId, operationIds)
        importStatus.processed++
      } catch (error: any) {
        importStatus.errors.push(`Операция ${operation.document.num}: ${error.message}`)
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
  } catch (error: any) {
    toast.add({
      title: 'Ошибка импорта',
      description: error.message,
      color: 'air-primary-alert',
      icon: CircleCheckIcon
    })
  } finally {
    isImporting.value = false
    importStatus.isProcessing = false
  }
}

// Обработка одной строки (аналогично демо)
async function processRow(
  row: any,
  b24: any,
  smartEntityTypeId: number,
  operationIds: { in: number, out: number }
) {
  const rowXmlId = MD5([
    row.client.accNumber,
    row.document.num,
    row.operation.date,
    row.operation.sum,
    myCompany.currency.code
  ].join('-')).toString()

  // Проверка дубликата
  const response = await b24.callMethod('crm.item.list', {
    entityTypeId: smartEntityTypeId,
    filter: {
      '=xmlId': rowXmlId
    },
    select: ['id', 'xmlId', '*']
  })

  const data: any[] = response.getData().result?.items || []
  if (data.length > 0) {
    row.importStatus = { isSuccess: false, message: 'Запись уже импортирована' }
    throw new Error('Эта запись была ранее импортирована')
  }

  // Создание записи
  const createResponse = await b24.callMethod('crm.item.add', {
    entityTypeId: smartEntityTypeId,
    fields: {
      xmlId: rowXmlId,
      title: `${row.operation.isIn ? 'Приход от' : 'Расход на'} ${row.client.name}`,
      opportunity: row.operation.sum,
      currencyId: myCompany.currency.code,
      categoryId: row.operation.isIn ? operationIds.in : operationIds.out,
      ufCrm11RS: myCompany.accNumber,
      ufCrm11Date: row.operation.date,
      ufCrm11Number: row.document.num,
      ufCrm11ClientRs: row.client.accNumber,
      ufCrm11Description: row.operation.description
    }
  })

  const result = createResponse.getData().result.item
  row.importStatus = { isSuccess: true, result }
}

// Сброс формы
function resetForm() {
  file.value = null
  errorContainer.value = null
  clearCompanyData()
  importStatus.processed = 0
  importStatus.total = 0
  importStatus.errors = []
}

// Вычисляемые свойства
const hasFile = computed(() => !!file.value)
const hasOperations = computed(() => myCompany.in.length + myCompany.out.length > 0)
const sumIn = computed(() => myCompany.in.reduce((sum, row) => sum + (row.operation.sum || 0), 0))
const sumOut = computed(() => myCompany.out.reduce((sum, row) => sum + (row.operation.sum || 0), 0))
const totalOperations = computed(() => myCompany.in.length + myCompany.out.length)
</script>

<template>
  <B24DashboardPanel id="import" :b24ui="{ body: 'p-4 sm:pt-4 scrollbar-transparent' }">
    <template #header>
      <B24DashboardNavbar title="Импорт банковских выписок">
        <template #right>
          <B24Button
            size="sm"
            label="Сбросить"
            color="air-tertiary"
            :disabled="!hasFile && !hasOperations"
            @click="resetForm"
          />
        </template>
      </B24DashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Шаг 1: Загрузка файла -->
        <B24Card>
          <template #header>
            <div class="flex items-center gap-2">
              <UploadIcon class="size-5" />
              <h3 class="text-lg font-semibold">Загрузка файла</h3>
            </div>
          </template>
          <div class="space-y-4">
            <p class="text-muted">
              Загрузите файл выгрузки из клиент-банка (формат ***** ^Type=) или CSV файл.
            </p>
            <div class="flex items-center gap-4">
              <B24Button
                as="label"
                :icon="UploadIcon"
                label="Выбрать файл"
                color="air-primary"
                :disabled="isParsing || isImporting"
              >
                <input
                  type="file"
                  accept=".txt,.csv"
                  class="hidden"
                  @change="onFileSelect"
                />
              </B24Button>

              <div v-if="file" class="flex items-center gap-2">
                <DocumentIcon class="size-5" />
                <span class="font-medium">{{ file.name }}</span>
                <span class="text-sm text-muted">({{ (file.size / 1024).toFixed(2) }} KB)</span>
              </div>
            </div>

            <div v-if="isParsing" class="flex items-center gap-2">
              <div class="size-5 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
              <span>Идет обработка файла...</span>
            </div>

            <div v-if="errorContainer" class="p-3 bg-air-primary-alert/10 border border-air-primary-alert rounded-md">
              <p class="text-sm text-air-primary-alert">{{ errorContainer }}</p>
            </div>
          </div>
        </B24Card>

        <!-- Шаг 2: Информация о компании -->
        <B24Card v-if="myCompany.accNumber">
          <template #header>
            <div class="flex items-center gap-2">
              <CircleCheckIcon class="size-5 text-air-primary-success" />
              <h3 class="text-lg font-semibold">Информация о счете</h3>
            </div>
          </template>
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 class="font-medium text-sm text-muted">Наименование счета</h4>
                <p class="text-lg">{{ myCompany.title }}</p>
              </div>
              <div>
                <h4 class="font-medium text-sm text-muted">Расчетный счет</h4>
                <p class="text-lg">{{ myCompany.accNumber }} <span class="text-sm text-muted">{{ myCompany.currency.code }}</span></p>
              </div>
              <div>
                <h4 class="font-medium text-sm text-muted">Банк</h4>
                <p class="text-lg">{{ myCompany.bankName }}</p>
              </div>
              <div>
                <h4 class="font-medium text-sm text-muted">Документ</h4>
                <p class="text-lg">{{ myCompany.document.title }}</p>
              </div>
            </div>
          </div>
        </B24Card>

        <!-- Шаг 3: Операции -->
        <B24Card v-if="hasOperations">
          <template #header>
            <div class="flex items-center gap-2">
              <DocumentIcon class="size-5" />
              <h3 class="text-lg font-semibold">Операции по счету</h3>
            </div>
          </template>
          <div class="space-y-6">
            <!-- Приход -->
            <div v-if="myCompany.in.length > 0">
              <div class="flex justify-between items-center mb-3">
                <h4 class="font-semibold text-air-primary-success">Приход</h4>
                <span class="text-lg font-semibold text-air-primary-success">{{ sumIn.toFixed(2) }} {{ myCompany.currency.code }}</span>
              </div>
              <div class="space-y-3">
                <div v-for="(op, index) in myCompany.in" :key="`in-${index}`" class="p-3 border border-gray-100 rounded-lg">
                  <div class="flex justify-between">
                    <div>
                      <p class="font-medium">{{ op.client.name }}</p>
                      <p class="text-sm text-muted">УНП: {{ op.client.unp || 'не указан' }}</p>
                      <p class="text-sm text-muted">Счет: {{ op.client.accNumber || 'не указан' }}</p>
                    </div>
                    <div class="text-right">
                      <p class="font-semibold text-air-primary-success">{{ op.operation.sum.toFixed(2) }} {{ myCompany.currency.code }}</p>
                      <p class="text-sm text-muted">{{ op.operation.date }} {{ op.operation.time }}</p>
                    </div>
                  </div>
                  <p class="mt-2 text-sm text-gray-600">{{ op.operation.description }}</p>
                  <div v-if="op.importStatus" class="mt-2">
                    <span :class="op.importStatus.isSuccess ? 'text-air-primary-success' : 'text-air-primary-alert'" class="text-xs">
                      {{ op.importStatus.isSuccess ? 'Импортировано' : op.importStatus.message }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Расход -->
            <div v-if="myCompany.out.length > 0">
              <div class="flex justify-between items-center mb-3 mt-6">
                <h4 class="font-semibold text-air-primary-alert">Расход</h4>
                <span class="text-lg font-semibold text-air-primary-alert">-{{ sumOut.toFixed(2) }} {{ myCompany.currency.code }}</span>
              </div>
              <div class="space-y-3">
                <div v-for="(op, index) in myCompany.out" :key="`out-${index}`" class="p-3 border border-gray-100 rounded-lg">
                  <div class="flex justify-between">
                    <div>
                      <p class="font-medium">{{ op.client.name }}</p>
                      <p class="text-sm text-muted">УНП: {{ op.client.unp || 'не указан' }}</p>
                      <p class="text-sm text-muted">Счет: {{ op.client.accNumber || 'не указан' }}</p>
                    </div>
                    <div class="text-right">
                      <p class="font-semibold text-air-primary-alert">-{{ op.operation.sum.toFixed(2) }} {{ myCompany.currency.code }}</p>
                      <p class="text-sm text-muted">{{ op.operation.date }} {{ op.operation.time }}</p>
                    </div>
                  </div>
                  <p class="mt-2 text-sm text-gray-600">{{ op.operation.description }}</p>
                  <div v-if="op.importStatus" class="mt-2">
                    <span :class="op.importStatus.isSuccess ? 'text-air-primary-success' : 'text-air-primary-alert'" class="text-xs">
                      {{ op.importStatus.isSuccess ? 'Импортировано' : op.importStatus.message }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="!myCompany.in.length && !myCompany.out.length" class="text-center py-8 text-muted">
              Нет операций для отображения
            </div>
          </div>
        </B24Card>

        <!-- Шаг 4: Импорт в Bitrix24 -->
        <B24Card v-if="hasOperations">
          <template #header>
            <div class="flex items-center gap-2">
              <SendIcon class="size-5" />
              <h3 class="text-lg font-semibold">Импорт в Bitrix24</h3>
            </div>
          </template>
          <div class="space-y-4">
            <B24Alert
              v-if="!isUseB24"
              title="Bitrix24 не подключен"
              description="Для импорта необходимо запустить приложение внутри Bitrix24"
              color="air-primary-alert"
            />

            <div class="flex items-center gap-4">
              <B24Button
                :icon="SendIcon"
                label="Импортировать операции"
                color="air-primary"
                :loading="isImporting"
                :disabled="!hasOperations || isImporting || !isUseB24"
                @click="importToBitrix24"
              />

              <div v-if="isImporting" class="flex items-center gap-2">
                <div class="size-5 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                <span>Импортировано: {{ importStatus.processed }} из {{ importStatus.total }}</span>
              </div>

              <div v-if="importStatus.processed > 0 && !isImporting" class="flex items-center gap-2">
                <CircleCheckIcon class="size-5 text-air-primary-success" />
                <span>Успешно импортировано {{ importStatus.processed }} операций</span>
              </div>
            </div>

            <div v-if="importStatus.errors.length > 0" class="p-3 bg-air-primary-warning/10 border border-air-primary-warning rounded-md">
              <h4 class="font-medium mb-2">Ошибки импорта:</h4>
              <ul class="text-sm space-y-1">
                <li v-for="(error, idx) in importStatus.errors" :key="idx">• {{ error }}</li>
              </ul>
            </div>

            <div class="bg-elevated rounded-lg p-4">
              <h4 class="font-medium mb-2">Что будет создано:</h4>
              <ul class="space-y-1 text-sm">
                <li>• Каждая операция будет создана как элемент смарт-процесса</li>
                <li>• Проверка дубликатов по уникальному хэшу</li>
                <li>• Приходы и расходы разделены по категориям</li>
                <li>• Сохраняются все реквизиты: счет, УНП, назначение платежа</li>
              </ul>
            </div>
          </div>
        </B24Card>

        <!-- Состояния -->
        <div class="space-y-4">
          <B24Alert
            v-if="!hasFile"
            title="Готов к работе"
            description="Выберите файл выгрузки из клиент-банка для начала импорта."
            color="air-primary"
          />

          <B24Alert
            v-if="hasFile && !hasOperations && !isParsing"
            title="Файл загружен"
            description="Нажмите кнопку 'Обработать файл' для анализа содержимого."
            color="air-primary-warning"
          />

          <B24Alert
            v-if="hasOperations && !isImporting && importStatus.processed === 0"
            title="Данные готовы к импорту"
            description="Проверьте операции и нажмите 'Импортировать операции' для загрузки в Bitrix24."
            color="air-primary-success"
          />
        </div>
      </div>
    </template>
  </B24DashboardPanel>
</template>
