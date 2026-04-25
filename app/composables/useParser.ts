/* eslint-disable */
export class BaseComponent {
  protected data: Record<string, any> = {}

  constructor(data: Record<string, any> = {}) {
    this.init()
    for (const [key, value] of Object.entries(data)) {
      if (!(key in this.data)) {
        throw new Error(`There should not be such field (${key}) in ${this.constructor.name}`)
      }
      this.data[key] = value
    }
  }

  protected init() {
    for (const field of (this.constructor as any).fields()) {
      this.data[field] = null
    }
  }

  protected toDate(val: string): string | null {
    const [day, month, year] = val.split('.')
    return year && month && day ? `${year}-${month}-${day}` : null
  }

  protected toTime(val: string): string | null {
    return val ? new Date(`1970-01-01T${val}Z`).toISOString().substr(11, 8) : null
  }

  protected toFloat(val: string): number {
    return parseFloat(val.replace(',', '.'))
  }

  protected toInt(val: string): number {
    return parseInt(val, 10)
  }
}

export class RemainingsSection extends BaseComponent {
  static fields() {
    return [
      'ДатаНачала',
      'ДатаКонца',
      'РасчСчет',
      'НачальныйОстаток',
      'ВсегоПоступило',
      'ВсегоСписано',
      'КонечныйОстаток'
    ]
  }

  constructor(data: Record<string, any> = {}) {
    super(data)
    for (const key of ['ДатаНачала', 'ДатаКонца']) {
      if (this.data[key]) {
        this.data[key] = this.toDate(this.data[key])
      }
    }
    for (const key of ['НачальныйОстаток', 'ВсегоПоступило', 'ВсегоСписано', 'КонечныйОстаток']) {
      if (this.data[key]) {
        this.data[key] = this.toFloat(this.data[key])
      }
    }
  }
}

export class GeneralSection extends BaseComponent {
  static fields() {
    return [
      'ВерсияФормата',
      'Кодировка',
      'Отправитель',
      'Получатель',
      'ДатаСоздания',
      'ВремяСоздания'
    ]
  }

  constructor(data: Record<string, any> = {}) {
    super(data)
    if (this.data['ДатаСоздания']) {
      this.data['ДатаСоздания'] = this.toDate(this.data['ДатаСоздания'])
    }
    if (this.data['ВремяСоздания']) {
      this.data['ВремяСоздания'] = this.toTime(this.data['ВремяСоздания'])
    }
  }
}

export class FilterSection extends BaseComponent {
  static fields() {
    return [] // Unknown fields, not used in demo
  }
}

export class DocumentSection extends BaseComponent {
  public type: string | null = null

  static fields() {
    return [
      'Номер',
      'Дата',
      'Сумма',
      'КвитанцияДата',
      'КвитанцияВремя',
      'КвитанцияСодержание',
      'ПлательщикСчет',
      'ДатаСписано',
      'Плательщик',
      'ПлательщикИНН',
      'Плательщик1',
      'Плательщик2',
      'Плательщик3',
      'Плательщик4',
      'ПлательщикРасчСчет',
      'ПлательщикБанк1',
      'ПлательщикБанк2',
      'ПлательщикБИК',
      'ПлательщикКорсчет',
      'ПолучательСчет',
      'ДатаПоступило',
      'Получатель',
      'ПолучательИНН',
      'Получатель1',
      'Получатель2',
      'Получатель3',
      'Получатель4',
      'ПолучательРасчСчет',
      'ПолучательБанк1',
      'ПолучательБанк2',
      'ПолучательБИК',
      'ПолучательКорсчет',
      'ВидПлатежа',
      'ВидОплаты',
      'Код',
      'НазначениеПлатежа',
      'НазначениеПлатежа 1',
      'НазначениеПлатежа 2',
      'НазначениеПлатежа 3',
      'НазначениеПлатежа 4',
      'НазначениеПлатежа 5',
      'НазначениеПлатежа 6',
      'СтатусСоставителя',
      'ПлательщикКПП',
      'ПолучательКПП',
      'ПоказательКБК',
      'ОКАТО',
      'ПоказательОснования',
      'ПоказательПериода',
      'ПоказательНомера',
      'ПоказательДаты',
      'ПоказательТипа',
      'Очередность',
      'СрокАкцепта',
      'ВидАккредитива',
      'СрокПлатежа',
      'УсловиеОплаты1',
      'УсловиеОплаты2',
      'УсловиеОплаты3',
      'ПлатежПоПредст',
      'ДополнУсловия',
      'НомерСчетаПоставщика',
      'ДатаОтсылкиДок'
    ]
  }

  constructor(type: string, data: Record<string, any> = {}) {
    super(data)
    this.type = type

    for (const key of ['Номер']) {
      if (this.data[key]) {
        this.data[key] = this.toInt(this.data[key])
      }
    }

    for (const key of ['Дата']) {
      if (this.data[key]) {
        this.data[key] = this.toDate(this.data[key])
      }
    }

    for (const key of ['Сумма']) {
      if (this.data[key]) {
        this.data[key] = this.toFloat(this.data[key])
      }
    }
  }

  public getData() {
    return this.data
  }
}

export class Parser {
  private encoding: string
  private result: any

  constructor(fileContent: string, encoding: string = 'windows-1251') {
    this.encoding = encoding
    this.result = this.parse(fileContent)
  }

  private defaultResult() {
    return {
      general: {} as any,
      filter: {} as any,
      remainings: {} as any,
      documents: [] as DocumentSection[]
    }
  }

  private parse(content: string) {
    const decoder = new TextDecoder(this.encoding)
    const encodedContent = new TextEncoder().encode(content)
    const decodedContent = decoder.decode(encodedContent)

    const result = this.defaultResult()

    const header = '1CClientBankExchange'
    if (header === decodedContent.substring(0, header.length)) {
      result.general = this.general(decodedContent)
      result.filter = this.filter(decodedContent)
      result.remainings = this.remainings(decodedContent)
      result.documents = this.documents(decodedContent)
    } else {
      throw new Error('Unexpected format: 1CClientBankExchange not found')
    }

    return result
  }

  private general(content: string) {
    const result: Record<string, any> = {}
    for (const key of GeneralSection.fields()) {
      const regex = new RegExp(`^${key}=(.+)`, 'um')
      const match = regex.exec(content)
      result[key] = match ? match[1].trim() : null
    }
    return new GeneralSection(result)
  }

  private filter(content: string) {
    const result: Record<string, any> = {}
    for (const key of FilterSection.fields()) {
      const regex = new RegExp(`^${key}=(.+)`, 'um')
      const match = regex.exec(content)
      result[key] = match ? match[1].trim() : null
    }

    return new FilterSection(result)
  }

  private remainings(content: string) {
    const result: Record<string, any> = {}
    const regex = /СекцияРасчСчет([\s\S]*?)\sКонецРасчСчет/um
    const match = regex.exec(content)
    if (match) {
      const part = match[1] || ''
      for (const line of part.split(/\r?\n/).filter(Boolean)) {
        const [key, val] = line.split('=').map(str => str.trim())
        result[key] = val
      }
    }
    return new RemainingsSection(result)
  }

  private documents(content: string): DocumentSection[] {
    const result: DocumentSection[] = []
    const regex = /СекцияДокумент=(.*)\s([\s\S]*?)\sКонецДокумента/um
    const matches = content.matchAll(regex)
    for (const match of matches) {
      const doc: Record<string, any> = {}
      const part = match[0]
      for (const line of part.split(/\r?\n/).filter(Boolean)) {
        const [key, val] = line.split('=').map(str => str.trim())
        doc[key] = val
      }
      const type = doc['СекцияДокумент']
      delete doc['СекцияДокумент']
      delete doc['КонецДокумента']
      result.push(new DocumentSection(type, doc))
    }
    return result
  }

  public getResult() {
    return this.result
  }
}

export class ParserTxtFile {
  private encoding: string
  private result: any

  constructor(
    fileContent: string,
    encoding: string = 'windows-1251'
  ) {
    this.encoding = encoding
    this.result = this.parse(fileContent)
  }

  private defaultResult() {
    return {
      GENERAL: {} as any,
      IN_PARAM: {} as any,
      OUT_PARAM: {} as any
    }
  }

  private parse(content: string) {
    const decoder = new TextDecoder(this.encoding)
    const encodedContent = new TextEncoder().encode(content)
    const decodedContent = decoder.decode(encodedContent)

    const result = this.defaultResult()

    const header = '***** ^Type='
    if (header === decodedContent.substring(0, header.length)) {
      const lines = decodedContent.split(/\r?\n/)
      let curSection = ''
      let i = -1

      for (const line of lines) {
        const firstChar = line.charAt(0)
        switch (firstChar) {
          case '*':
            const subMatches = line.split('^').filter(Boolean)
            if (subMatches.length >= 2) {
              let val = subMatches[1].split('=')
              if (val.length >= 2) result.GENERAL['TYPE'] = val[1]

              if (subMatches.length >= 4) {
                val = subMatches[3].split('=')
                if (val.length >= 2) result.GENERAL['ACC'] = val[1]
              }

              if (subMatches.length >= 5) {
                val = subMatches[4].split('-')
                if (val.length < 2 && subMatches.length >= 7) {
                  val = subMatches[6].split('-')
                }
                if (val.length >= 2) result.GENERAL['TITLE'] = val[1].trim()
              }
            }
            break
          case '[':
            if (line.trim() === '[OUT_PARAM]') {
              curSection = 'OUT_PARAM'
              i = -1
            } else if (line.trim() === '[IN_PARAM]') {
              curSection = 'IN_PARAM'
              i = -1
            }
            break
          case '^':
            const cleanLine = line.replaceAll('^', '')
            const [key, value] = cleanLine.split('=').map(str => str.trim())

            const headerKeys = this.getHeaderKeys()
            const footerKeys = this.getFooterKeys()
            const itemKeys = this.getItemKeys()
            let curSubSection = ''
            let key2: string | false = false

            if (headerKeys.includes(key)) {
              curSubSection = 'header'
              if (key === 'CrIn' || key === 'InCre') {
                key2 = 'RestIn'
              }
            } else if (footerKeys.includes(key)) {
              curSubSection = 'footer'
              if (key === 'CrOut' || key === 'OutCre') {
                key2 = 'RestOut'
              }
            } else if (itemKeys.includes(key)) {
              curSubSection = 'items'
              if (key === 'DocDate' || key === 'DateIn' || key === 'DateOut') {
                value.replace('/', '.')
                if (key === 'DocDate') {
                  i += 1
                  key2 = 'OpDate'
                }
              } else if (key === 'DocTime') {
                key2 = 'OpTime'
              } else if (key === 'UNNRec') {
                key2 = 'KorUNP'
              } else if (key === 'CrIn') {
                key2 = 'RestIn'
              } else if (key === 'CrOut') {
                key2 = 'RestOut'
              } else if (key === 'Amount') {
                key2 = 'Amount'
              }
            } else {
              curSubSection = 'wtf'
            }

            if (curSubSection === 'items') {
              if (!result[curSection][curSubSection]) {
                result[curSection][curSubSection] = []
              }
              if (!result[curSection][curSubSection][i]) {
                result[curSection][curSubSection][i] = {}
              }
              result[curSection][curSubSection][i][key] = value
              if (key2 !== false) {
                result[curSection][curSubSection][i][key2] = value
              }
            } else {
              if (!result[curSection][curSubSection]) {
                result[curSection][curSubSection] = {}
              }
              result[curSection][curSubSection][key] = value
            }
            break
          case '#':
          default:
            break
        }
      }
    } else {
      throw new Error('Unexpected file format')
    }
    return result
  }

  private getHeaderKeys() {
    return [
      'Time',
      'Header1',
      'Header2',
      'Header3',
      'Header4',
      'Header5',
      'DateBegin',
      'DateEnd',
      'DateIn',
      'RestIn', 'CrIn',
      'CrInQ',
      'RestInQ',
      'InCre',
      'InCreQ',
      'AcPa',
      'AcPa1',
      'I1',
      'I1str',
      'UNN'
    ]
  }

  private getFooterKeys() {
    return [
      'DB',
      'CR',
      'RestOut',
      'DebVQ',
      'CreVQ',
      'DebV',
      'CreV',
      'RestOutQ',
      'CrOut',
      'OutCre',
      'DebOut'
    ]
  }

  private getItemKeys() {
    return [
      'DocDate',
      'DocTime',
      'Num',
      'Opr',
      'PaymCode',
      'Code',
      'Acc',
      'DebQ',
      'CreQ',
      'Deb',
      'Cre',
      'I2',
      'Amount',
      'Rate',
      'KorUNP', 'UNNRec',
      'KorName',
      'Nazn',
      'Nazn2',
      'OpDate',
      'Credit',
      'Db',
      'OutRate'
    ]
  }

  public getResult() {
    return this.result
  }
}
