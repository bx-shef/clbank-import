# Nuxt Dashboard Template

[![Bitrix24 UI](https://img.shields.io/badge/Made%20with-Bitrix24%20UI-2fc6f6?logo=bitrix24&labelColor=020420)](https://bitrix24.github.io/b24ui/)

Get started with the Nuxt dashboard template with multiple pages, collapsible sidebar, keyboard shortcuts, light & dark mode, command palette and more, powered by [Bitrix24 UI](https://bitrix24.github.io/b24ui/).

- [Live Demo](https://bitrix24.github.io/templates-dashboard/)
- [@bitrix24/b24ui](https://bitrix24.github.io/b24ui/docs/getting-started/installation/vue/)
- [@bitrix24/b24icons](https://bitrix24.github.io/b24icons/)
- [@bitrix24/b24jssdk](https://bitrix24.github.io/b24jssdk/)

> The dashboard template for Vue is on https://github.com/bitrix24/templates-dashboard-vue.

## Quick Start

```bash [Terminal]
git clone https://github.com/bitrix24/templates-dashboard.git <project-name>
cd <project-name>
```

## Setup

Make sure to install the dependencies:

```bash
pnpm install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
```

## Production

Build the application for production:

```bash
pnpm build
```

Locally preview production build:

```bash
pnpm preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

> [!NOTE]
> The idea is that this template can be used as a full-fledged Bitrix24 application. And without connecting to Bitrix24, it can display test data.
> As soon as we do this, we'll add instructions here.

# As B24 App

A browser-based application for Bitrix24.

## Required Scopes

The following permissions must be enabled in the application settings:
* `crm` — access to CRM entities.
* `user_brief` — access to basic user profile data.

## Configuration

When registering the application in the Bitrix24 Partner Portal or as a local app, use the following endpoints:

| Parameter | URL |
| :--- | :--- |
| **Application URL** | `https://your-app.example.com` |

## Getting Started

1. Open your **Bitrix24**.
2. Go to **Applications** -> **Add Application**
3. Select **Local Application**
4. Fill in the URLs provided above and check the required **Scopes**.
5. Click **Save** and open the app.

# Translate

```
pnpm run translate-ui
```


# Отчет о проделанной работе

## 1. Анализ демо-приложения

Провел детальный анализ демо-приложения в папке `@app\demo\` и выявил следующие ключевые компоненты:

### **Форматы файлов, которые поддерживает демо:**
1. **Формат 1CClientBankExchange** - старый формат 1C для банковских выписок
2. **Банковская выгрузка (`***** ^Type=...`)** - основной целевой формат
3. **CSV как резервный вариант**

### **Ключевые компоненты демо:**
- **Парсеры** (`useParser.ts`): классы `Parser` (для 1C) и `ParserTxtFile` (для банковской выгрузки)
- **Логика обработки файлов**: декодирование win1251 → utf8, маппинг полей, разделение операций на приход/расход
- **Интеграция с Bitrix24**: использование смарт-процесса (entityTypeId: 1036) вместо обычных лидов
- **Проверка дубликатов**: генерация XML_ID через MD5 хэш (аккаунт + номер документа + дата + сумма + валюта)

### **Структура данных после парсинга:**
```typescript
myCompany = {
  title: string,           // Название счета
  accNumber: string,       // Расчетный счет
  currency: { code, number },
  bankName: string,
  document: { title },
  in: [],                  // Приходные операции
  out: []                  // Расходные операции
}
```

## 2. Сравнение с текущим приложением

| Аспект | Текущее приложение | Демо-приложение |
|--------|-------------------|-----------------|
| **Форматы файлов** | Только CSV | 1CClientBankExchange + банковская выгрузка + CSV |
| **Парсинг** | Простой разделитель | Сложные парсеры с маппингом полей |
| **Bitrix24 интеграция** | Создание лидов (crm.lead.add) | Смарт-процесс (crm.item.add, entityTypeId: 1036) |
| **Проверка дубликатов** | Нет | MD5 хэш + проверка через crm.item.list |
| **Отображение данных** | Единая таблица | Разделение приход/расход + детали по счету |

## 3. Выполненные работы

### **3.1. Установка зависимостей**
- `iconv-lite` - декодирование win1251 кодировки
- `crypto-js` - генерация MD5 хэшей для проверки дубликатов
- `buffer` - работа с бинарными данными файлов
- `@types/crypto-js` - типы TypeScript

### **3.2. Адаптация парсеров из демо**
- Скопировал и адаптировал `useParser.ts` из демо
- Переименовал `Component` → `BaseComponent` (во избежание конфликта с Vue)
- Добавил обработку ошибок и проверки типов
- Сохранил оба парсера: `Parser` (1C) и `ParserTxtFile` (банковская выгрузка)

### **3.3. Полная переработка главной страницы (`index.vue`)**

#### **Новая функциональность:**
1. **Автоматическое определение формата файла**
  - Банковская выгрузка (`***** ^Type=`)
  - 1CClientBankExchange
  - CSV (резервный вариант)

2. **Декодирование кодировок**
  - Автоматическое преобразование win1251 → utf8
  - Резервное использование utf8 при ошибках

3. **Маппинг данных в структуру компании**
  - Извлечение названия счета, банка, валюты
  - Разделение операций на приходные и расходные
  - Форматирование дат и сумм

4. **Обновленный интерфейс**
  - Сохранен Bitrix24 UI дизайн
  - Добавлены секции:
    - Информация о счете (банк, счет, валюта)
    - Приходные операции (зеленый цвет)
    - Расходные операции (красный цвет)
    - Прогресс импорта

5. **Интеграция с Bitrix24 через смарт-процесс**
  - Используется `entityTypeId: 1036` (как в демо)
  - Генерация уникального XML_ID через MD5 хэш
  - Проверка дубликатов перед созданием
  - Использование пользовательских полей:
    - `ufCrm11RS` - расчетный счет компании
    - `ufCrm11Date` - дата операции
    - `ufCrm11Number` - номер документа
    - `ufCrm11ClientRs` - счет контрагента
    - `ufCrm11Description` - назначение платежа

6. **Обратная совместимость с CSV**
  - CSV файлы преобразуются в структуру операций
  - Автоматическое определение приход/расход по знаку суммы
  - Сохранение базовой информации

### **3.4. Тестирование**
- Проверена компиляция TypeScript без ошибок
- Созданы тестовые файлы:
  - `test_bank.txt` - пример банковской выгрузки
  - `test.csv` - пример CSV файла
- Приложение готово к запуску внутри Bitrix24

## 4. Архитектурные изменения

### **До:**
```
CSV файл → Простой парсинг → Лиды в Bitrix24
```

### **После:**
```
Файл (3 формата) → Соответствующий парсер → Структура компании → Смарт-процесс в Bitrix24
                     ↑
                Декодирование кодировок
                     ↑
                Проверка дубликатов (MD5)
```

## 5. Инструкция по использованию

1. **Запуск приложения:**
   ```bash
   cd app
   pnpm dev
   ```

2. **Загрузка файлов:**
  - Банковская выгрузка (формат `***** ^Type=...`)
  - 1CClientBankExchange (старый формат 1C)
  - CSV файлы (обратная совместимость)

3. **Просмотр данных:**
  - Информация о счете (банк, номер счета, валюта)
  - Раздельные списки приходных и расходных операций
  - Детали по каждой операции

4. **Импорт в Bitrix24:**
  - Требуется запуск внутри Bitrix24 (для доступа к API)
  - Автоматическая проверка дубликатов
  - Создание элементов смарт-процесса (entityTypeId: 1036)

## 6. Ограничения и рекомендации

### **Текущие ограничения:**
- Идентификатор смарт-процесса зафиксирован как `1036` (как в демо)
- Формат 1CClientBankExchange добавлен, но требует тестирования
- Кодировка определяется автоматически (win1251/utf8)

### **Рекомендации для дальнейшего развития:**
1. Сделать `entityTypeId` настраиваемым через конфигурацию
2. Добавить поддержку дополнительных форматов банковских выписок
3. Реализовать пакетный импорт с обработкой ошибок
4. Добавить настройки маппинга полей под разные банки

## 7. Заключение

Приложение полностью переработано и теперь работает по той же логике, что и демо-приложение:

✅ **Поддержка банковских форматов** (основной формат + 1C)
✅ **Интеграция со смарт-процессом Bitrix24** (entityTypeId: 1036)
✅ **Проверка дубликатов через MD5 хэш**
✅ **Разделение операций на приход/расход**
✅ **Обратная совместимость с CSV**
✅ **Сохранен Bitrix24 UI дизайн**
✅ **Декодирование win1251 кодировки**

Приложение готово к использованию и тестированию с реальными банковскими выписками.
