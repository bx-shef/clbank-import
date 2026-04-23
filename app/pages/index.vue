<!-- eslint-disable vue/no-v-html -->
<script setup lang="ts">
import UploadIcon from '@bitrix24/b24icons-vue/outline/UploadIcon'
import DocumentIcon from '@bitrix24/b24icons-vue/main/DocumentIcon'
import SendIcon from '@bitrix24/b24icons-vue/outline/SendIcon'
import CircleCheckIcon from '@bitrix24/b24icons-vue/outline/CircleCheckIcon'
import { BYTES_PER_KB } from '~/constants/clbank'
import { useBankStatementPresentation } from '~/composables/useBankStatementPresentation'
import { useClBankImportPage } from '~/composables/useClBankImportPage'

const {
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
} = useClBankImportPage()

const {
  formatAmountForDisplay,
  formatAccountDisplay,
  formatNumberForDisplay
} = useBankStatementPresentation()
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
              <h2 class="text-2xl font-semibold">
                Загрузка файла
              </h2>
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
                >
              </B24Button>

              <div v-if="file" class="flex items-center gap-2">
                <DocumentIcon class="size-5" />
                <span class="font-medium">{{ file.name }}</span>
                <span class="text-sm text-muted">({{ formatNumberForDisplay(file.size / BYTES_PER_KB) }} KB)</span>
              </div>
            </div>

            <div v-if="isParsing" class="flex items-center gap-2">
              <div class="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span>Идет обработка файла...</span>
            </div>

            <div v-if="errorContainer" class="p-3 bg-air-primary-alert/10 border border-air-primary-alert rounded-md">
              <p class="text-sm text-air-primary-alert">
                {{ errorContainer }}
              </p>
            </div>
          </div>
        </B24Card>

        <!-- Шаг 2: Информация о компании -->
        <B24Card v-if="myCompany.accNumber">
          <template #header>
            <div class="flex items-center gap-2">
              <CircleCheckIcon class="size-5 text-air-primary-success" />
              <h2 class="text-2xl font-semibold">
                Информация о счете
              </h2>
            </div>
          </template>
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 class="font-medium text-sm text-muted">
                  Наименование счета
                </h4>
                <p class="text-lg">
                  {{ myCompany.title }}
                </p>
              </div>
              <div>
                <h4 class="font-medium text-sm text-muted">
                  Расчетный счет
                </h4>
                <p class="text-lg">
                  {{ formatAccountDisplay(myCompany.accNumber) }} <span class="text-sm text-muted">{{ myCompany.currency.code }}</span>
                </p>
              </div>
              <div>
                <h4 class="font-medium text-sm text-muted">
                  Банк
                </h4>
                <p class="text-lg">
                  {{ myCompany.bankName }}
                </p>
              </div>
              <div>
                <h4 class="font-medium text-sm text-muted">
                  Документ
                </h4>
                <p class="text-lg">
                  {{ myCompany.document.title }}
                </p>
              </div>
            </div>
          </div>
        </B24Card>

        <!-- Шаг 3: Операции -->
        <B24Card v-if="hasOperations">
          <template #header>
            <div class="flex items-center gap-2">
              <DocumentIcon class="size-5" />
              <h2 class="text-2xl font-semibold">
                Операции по счету
              </h2>
            </div>
          </template>
          <div class="space-y-6">
            <!-- Приход -->
            <B24Card>
              <template #header>
                <div class="flex justify-between items-center mb-3">
                  <h4 class="font-semibold text-air-primary-success">
                    Приход
                  </h4>
                  <span class="text-lg font-semibold text-air-primary-success" v-html="formatAmountForDisplay(sumIn, myCompany.currency.code)" />
                </div>
              </template>
              <div v-if="myCompany.in.length > 0" class="max-h-[30vh] overflow-y-auto">
                <div class="space-y-3">
                  <div v-for="(op, index) in myCompany.in" :key="`in-${index}`" class="p-3 border border-gray-100 rounded-lg">
                    <div class="flex justify-between">
                      <div>
                        <p class="font-medium">
                          {{ op.client.name }}
                        </p>
                        <p class="text-sm text-muted">
                          УНП: {{ op.client.unp || 'не указан' }}
                        </p>
                        <p class="text-sm text-muted">
                          Счет: {{ formatAccountDisplay(op.client.accNumber) }}
                        </p>
                      </div>
                      <div class="text-right">
                        <p class="font-semibold text-air-primary-success" v-html="formatAmountForDisplay(op.operation.sum, myCompany.currency.code)" />
                        <p class="text-sm text-muted">
                          {{ op.operation.date }} {{ op.operation.time }}
                        </p>
                      </div>
                    </div>
                    <p class="mt-2 text-sm text-gray-600">
                      {{ op.operation.description }}
                    </p>
                    <div v-if="op.importStatus" class="mt-2">
                      <span :class="op.importStatus.isSuccess ? 'text-air-primary-success' : 'text-air-primary-alert'" class="text-xs">
                        {{ op.importStatus.isSuccess ? 'Импортировано' : op.importStatus.message }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </B24Card>

            <!-- Расход -->
            <B24Card>
              <template #header>
                <div class="flex justify-between items-center mb-3 mt-6">
                  <h4 class="font-semibold text-air-primary-alert">
                    Расход
                  </h4>
                  <span class="text-lg font-semibold text-air-primary-alert" v-html="formatAmountForDisplay(-sumOut, myCompany.currency.code)" />
                </div>
              </template>
              <div v-if="myCompany.out.length > 0" class="max-h-[30vh] overflow-y-auto">
                <div class="space-y-3">
                  <div v-for="(op, index) in myCompany.out" :key="`out-${index}`" class="p-3 border border-gray-100 rounded-lg">
                    <div class="flex justify-between">
                      <div>
                        <p class="font-medium">
                          {{ op.client.name }}
                        </p>
                        <p class="text-sm text-muted">
                          УНП: {{ op.client.unp || 'не указан' }}
                        </p>
                        <p class="text-sm text-muted">
                          Счет: {{ formatAccountDisplay(op.client.accNumber) }}
                        </p>
                      </div>
                      <div class="text-right">
                        <p class="font-semibold text-air-primary-alert" v-html="formatAmountForDisplay(-op.operation.sum, myCompany.currency.code)" />
                        <p class="text-sm text-muted">
                          {{ op.operation.date }} {{ op.operation.time }}
                        </p>
                      </div>
                    </div>
                    <p class="mt-2 text-sm text-gray-600">
                      {{ op.operation.description }}
                    </p>
                    <div v-if="op.importStatus" class="mt-2">
                      <span :class="op.importStatus.isSuccess ? 'text-air-primary-success' : 'text-air-primary-alert'" class="text-xs">
                        {{ op.importStatus.isSuccess ? 'Импортировано' : op.importStatus.message }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </B24Card>

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
              <h2 class="text-2xl font-semibold">
                Импорт в Bitrix24
              </h2>
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
                <div class="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>Импортировано: {{ importStatus.processed }} из {{ importStatus.total }}</span>
              </div>

              <div v-if="importStatus.processed > 0 && !isImporting" class="flex items-center gap-2">
                <CircleCheckIcon class="size-5 text-air-primary-success" />
                <span>Успешно импортировано {{ importStatus.processed }} операций</span>
              </div>
            </div>

            <div v-if="importStatus.errors.length > 0" class="p-3 bg-air-primary-warning/10 border border-air-primary-warning rounded-md">
              <h4 class="font-medium mb-2">
                Ошибки импорта:
              </h4>
              <ul class="text-sm space-y-1">
                <li v-for="(error, idx) in importStatus.errors" :key="idx">
                  • {{ error }}
                </li>
              </ul>
            </div>

            <div class="bg-elevated rounded-lg p-4">
              <h4 class="font-medium mb-2">
                Что будет создано:
              </h4>
              <ul class="space-y-1 text-sm">
                <li>• Каждая операция будет создана как элемент списка «Платежи»</li>
                <li>• Проверка дубликатов по уникальному хэшу</li>
                <li>• Приходы и расходы разделены по полю «Направление»</li>
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
            description="Файл загружен и автоматически обработан. Проверьте найденные операции."
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

    <template #footer>
      <B24Footer>
        <template #left>
          <p class="text-sm">
            © {{ footerYear }} Битрикс24
          </p>
        </template>
        <template #right>
          <p v-if="hasOperations" class="text-sm">
            Операций: {{ totalOperations }}
          </p>
        </template>
      </B24Footer>
    </template>
  </B24DashboardPanel>
</template>
