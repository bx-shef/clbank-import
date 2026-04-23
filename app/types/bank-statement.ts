export interface ClBankGeneral {
  TYPE?: string
  ACC?: string
  TITLE?: string
}

export interface ClBankOutHeader {
  Header1?: string
  Header5?: string
}

export interface ClBankOutWtf {
  I3?: string
  MyBankName?: string
}

export interface ClBankItemRow {
  Num?: string
  DocDate?: string
  DocTime?: string
  OpDate?: string
  OpTime?: string
  Nazn?: string
  Nazn2?: string
  KorName?: string
  UNNRec?: string
  KorUNP?: string
  Acc?: string
  Db?: string
  DebQ?: string
  Deb?: string
  Credit?: string
  CreQ?: string
  Cre?: string
}

export interface ClBankOutParam {
  header?: ClBankOutHeader
  wtf?: ClBankOutWtf
  items?: ClBankItemRow[]
}

export interface ClBankParsedResult {
  GENERAL: ClBankGeneral
  OUT_PARAM: ClBankOutParam
}

export interface CsvRow {
  id: number
  date: string
  amount: number
  description: string
  contractor: string
}

export interface ImportRowStatus {
  isSuccess: boolean
  message?: string
  result?: unknown
}

export interface BankOperationDocument {
  num: string
  date: string
  time: string
}

export interface BankOperationData {
  date: string
  time: string
  description: string
  sum: number
  isIn: boolean
}

export interface BankClient {
  name: string
  unn: string
  unp: string
  accNumber: string
}

export interface BankOperation {
  document: BankOperationDocument
  operation: BankOperationData
  client: BankClient
  importStatus: ImportRowStatus | null
}

export interface CompanyCurrency {
  code: string
  number: number
}

export interface CompanyStatement {
  title: string
  accNumber: string | null
  currCode: string | null
  type: number
  bankName: string
  document: {
    title: string
  }
  currency: CompanyCurrency
  in: BankOperation[]
  out: BankOperation[]
}

export interface ImportStatus {
  isProcessing: boolean
  processed: number
  total: number
  errors: string[]
}
