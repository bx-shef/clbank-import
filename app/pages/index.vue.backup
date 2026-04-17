<script setup lang="ts">
import { ref, computed } from 'vue'
import { useB24 } from '~/composables/useB24'
import UploadIcon from '@bitrix24/b24icons-vue/outline/UploadIcon'
import DocumentIcon from '@bitrix24/b24icons-vue/main/DocumentIcon'
import SendIcon from '@bitrix24/b24icons-vue/outline/SendIcon'
import CircleCheckIcon from '@bitrix24/b24icons-vue/outline/CircleCheckIcon'

const toast = useToast()
const b24Instance = useB24()
const isUseB24 = computed(() => b24Instance.isInit())

// Состояния
const file = ref<File | null>(null)
const isLoading = ref(false)
const isParsing = ref(false)
const isSending = ref(false)
const parsedData = ref<any[]>([])
const leadsCreated = ref(0)

// Обработчик выбора файла
function onFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    file.value = target.files[0]!
  }
}

// Парсинг CSV/текстового файла
function parseCSV(text: string) {
  const lines = text.split('\n').filter(line => line.trim() !== '')
  if (lines.length === 0) return []

  // Определяем разделитель: запятая, точка с запятой или табуляция
  const firstLine = lines[0]!
  let delimiter = ','
  if (firstLine.includes(';')) delimiter = ';'
  else if (firstLine.includes('\t')) delimiter = '\t'

  // Парсим строки
  const result = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const parts = line.split(delimiter).map(part => part.trim().replace(/^"|"$/g, ''))

    // Предполагаем формат: Дата, Сумма, Описание, Контрагент
    // Если частей меньше 4, пытаемся интерпретировать
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

// Парсинг файла на клиенте
async function parseFile() {
  if (!file.value) return

  isParsing.value = true
  parsedData.value = []

  try {
    const text = await file.value.text()
    const parsed = parseCSV(text)

    if (parsed.length === 0) {
      toast.add({
        title: 'Файл пуст или неверный формат',
        description: 'Не удалось извлечь данные из файла. Убедитесь, что файл содержит данные в текстовом формате.',
        color: 'air-primary-alert',
        icon: CircleCheckIcon
      })
    } else {
      parsedData.value = parsed
      toast.add({
        title: 'Файл успешно обработан',
        description: `Найдено ${parsedData.value.length} платежных документов`,
        color: 'air-primary-success',
        icon: CircleCheckIcon
      })
    }
  } catch (error) {
    console.error('Ошибка при обработке файла:', error)
    toast.add({
      title: 'Ошибка обработки файла',
      description: 'Не удалось прочитать файл. Проверьте формат и кодировку.',
      color: 'air-primary-alert',
      icon: CircleCheckIcon
    })
  } finally {
    isParsing.value = false
  }
}

// Отправка данных в Bitrix24 как лиды
async function sendToBitrix24() {
  if (parsedData.value.length === 0) return

  // Проверка инициализации Bitrix24
  if (!isUseB24.value) {
    toast.add({
      title: 'Bitrix24 не инициализирован',
      description: 'Приложение должно быть запущено внутри Bitrix24 для создания лидов.',
      color: 'air-primary-alert',
      icon: CircleCheckIcon
    })
    return
  }

  const b24 = b24Instance.get()
  if (!b24) {
    toast.add({
      title: 'Ошибка подключения',
      description: 'Не удалось получить экземпляр Bitrix24.',
      color: 'air-primary-alert',
      icon: CircleCheckIcon
    })
    return
  }

  isSending.value = true
  leadsCreated.value = 0
  const errors: string[] = []

  for (const item of parsedData.value) {
    try {
      // Вызов метода Bitrix24 REST API: crm.lead.add
      const response = await b24.callMethod('crm.lead.add', {
        fields: {
          TITLE: `Платеж от ${item.contractor}`,
          NAME: item.contractor,
          OPPORTUNITY: item.amount,
          COMMENTS: item.description,
          DATE_CREATE: item.date,
          STATUS_ID: 'NEW',
          OPENED: 'Y',
          CURRENCY_ID: 'RUB'
        },
        params: {
          REGISTER_SONET_EVENT: 'Y'
        }
      })

      const result = response.getData()?.result
      console.info(`Создан лид с ID ${result}`)
      leadsCreated.value++
    } catch (error) {
      console.error('Ошибка при создании лида:', error)
      errors.push(`Платеж ${item.id}: ${error}`)
    }
  }

  isSending.value = false

  if (errors.length === 0) {
    toast.add({
      title: 'Лиды успешно созданы',
      description: `Создано ${leadsCreated.value} лидов в Bitrix24`,
      color: 'air-primary-success',
      icon: CircleCheckIcon
    })
  } else {
    toast.add({
      title: 'Созданы не все лиды',
      description: `Создано ${leadsCreated.value} из ${parsedData.value.length} лидов. Ошибки: ${errors.length}`,
      color: 'air-primary-warning',
      icon: CircleCheckIcon
    })
  }
}

// Сброс формы
function resetForm() {
  file.value = null
  parsedData.value = []
  leadsCreated.value = 0
}

// Вычисляемые свойства
const hasFile = computed(() => !!file.value)
const hasParsedData = computed(() => parsedData.value.length > 0)
const totalAmount = computed(() => parsedData.value.reduce((sum, item) => sum + item.amount, 0))
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
            :disabled="!hasFile && !hasParsedData"
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
              Загрузите текстовый файл выгрузки из клиента банка. Файл будет обработан непосредственно в вашем браузере.
            </p>
            <div class="flex items-center gap-4">
              <B24Button
                as="label"
                :icon="UploadIcon"
                label="Выбрать файл"
                color="air-primary"
                :disabled="isParsing || isSending"
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

            <div v-if="file && !isParsing && !hasParsedData" class="flex items-center gap-4">
              <B24Button
                label="Обработать файл"
                color="air-primary-success"
                :disabled="isParsing || isSending"
                @click="parseFile"
              />
              <span class="text-sm text-muted">Нажмите, чтобы начать разбор файла</span>
            </div>

            <div v-if="isParsing" class="flex items-center gap-2">
              <div class="size-5 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
              <span>Идет обработка файла...</span>
            </div>
          </div>
        </B24Card>

        <!-- Шаг 2: Результаты парсинга -->
        <B24Card v-if="hasParsedData">
          <template #header>
            <div class="flex items-center gap-2">
              <CircleCheckIcon class="size-5 text-air-primary-success" />
              <h3 class="text-lg font-semibold">Найденные платежные документы</h3>
            </div>
          </template>
          <div class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="bg-elevated rounded-lg p-4 border border-default">
                <div class="text-sm text-muted">Всего документов</div>
                <div class="text-2xl font-semibold text-air-primary">{{ parsedData.length }}</div>
              </div>
              <div class="bg-elevated rounded-lg p-4 border border-default">
                <div class="text-sm text-muted">Общая сумма</div>
                <div class="text-2xl font-semibold text-air-primary-success">{{ totalAmount.toFixed(2) }} ₽</div>
              </div>
              <div class="bg-elevated rounded-lg p-4 border border-default">
                <div class="text-sm text-muted">Дата первой операции</div>
                <div class="text-2xl font-semibold text-air-primary-warning">{{ parsedData[0]?.date || '—' }}</div>
              </div>
            </div>

            <B24Table :data="parsedData" :columns="[
              { id: 'id', header: 'ID', accessorKey: 'id' },
              { id: 'date', header: 'Дата', accessorKey: 'date' },
              { id: 'contractor', header: 'Контрагент', accessorKey: 'contractor' },
              { id: 'description', header: 'Описание', accessorKey: 'description' },
              { id: 'amount', header: 'Сумма', accessorKey: 'amount', cell: ({ row }) => `${row.original.amount.toFixed(2)} ₽` }
            ]" />
          </div>
        </B24Card>

        <!-- Шаг 3: Отправка в Bitrix24 -->
        <B24Card v-if="hasParsedData">
          <template #header>
            <div class="flex items-center gap-2">
              <SendIcon class="size-5" />
              <h3 class="text-lg font-semibold">Отправка в Bitrix24</h3>
            </div>
          </template>
          <div class="space-y-4">
            <p class="text-muted">
              Создать лиды в Bitrix24 на основе обработанных платежных документов.
            </p>

            <B24Alert
              v-if="!isUseB24"
              title="Bitrix24 не подключен"
              description="Для создания лидов необходимо запустить приложение внутри Bitrix24. Используйте режим установки для тестирования."
              color="air-primary-alert"
            />

            <div class="flex items-center gap-4">
              <B24Button
                :icon="SendIcon"
                label="Создать лиды"
                color="air-primary"
                :loading="isSending"
                :disabled="!hasParsedData || isSending || !isUseB24"
                @click="sendToBitrix24"
              />

              <div v-if="isSending" class="flex items-center gap-2">
                <div class="size-5 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                <span>Создано лидов: {{ leadsCreated }} из {{ parsedData.length }}</span>
              </div>

              <div v-if="leadsCreated > 0 && !isSending" class="flex items-center gap-2">
                <CircleCheckIcon class="size-5 text-air-primary-success" />
                <span>Успешно создано {{ leadsCreated }} лидов</span>
              </div>
            </div>

            <div class="bg-elevated rounded-lg p-4">
              <h4 class="font-medium mb-2">Что будет создано:</h4>
              <ul class="space-y-1 text-sm">
                <li>• Каждый платежный документ будет преобразован в отдельный лид</li>
                <li>• Название лида: "Платеж от [Контрагент]"</li>
                <li>• Сумма лида: сумма платежа</li>
                <li>• В комментариях будет указано описание платежа</li>
                <li>• Дата создания лида соответствует дате операции</li>
              </ul>
            </div>
          </div>
        </B24Card>

        <!-- Состояния -->
        <div class="space-y-4">
          <B24Alert
            v-if="!hasFile"
            title="Готов к работе"
            description="Выберите файл выгрузки из клиента банка для начала импорта."
            color="air-primary"
          />

          <B24Alert
            v-if="hasFile && !hasParsedData && !isParsing"
            title="Файл загружен"
            description="Нажмите кнопку 'Обработать файл' для анализа содержимого."
            color="air-primary-warning"
          />

          <B24Alert
            v-if="hasParsedData && !isSending && leadsCreated === 0"
            title="Данные готовы к отправке"
            description="Проверьте найденные платежные документы и нажмите 'Создать лиды' для импорта в Bitrix24."
            color="air-primary-success"
          />
        </div>
      </div>
    </template>
  </B24DashboardPanel>
</template>
