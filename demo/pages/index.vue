<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import ImportIcon from '@bitrix24/b24icons-vue/common-service/ImportIcon'
import BtnSpinnerIcon from '@bitrix24/b24icons-vue/button-specialized/BtnSpinnerIcon'
import { ParserTxtFile } from '~/composables/useParser'
import { B24Icon } from '@bitrix24/b24icons-vue'
import * as iconv from 'iconv-lite'
import { Buffer } from 'buffer'
import useFormatter from "@bxshefby/b24jssdk/tools/useFormatters";
import { LoggerBrowser, Result, type IResult } from '@bxshefby/b24jssdk'
import { B24Frame } from '@bxshefby/b24jssdk/frame'
import { AjaxResult } from '@bxshefby/b24jssdk/core/http/ajaxResult'
import MD5 from 'crypto-js/md5'

// region Init ////

const smartEntityTypeId = 1036

enum OperationId {
	in = 14,
	out = 16,
}

definePageMeta({
	layout: "app"
});
const { $initB24Frame } = useNuxtApp();
const { formatterIban, formatterNumber } = useFormatter('ru-RU')

const logger = LoggerBrowser.build(
	'App',
	true
)

let B24: B24Frame;
const isInit: Ref<boolean> = ref(false)

onMounted(async () => {
	return $initB24Frame()
	.then(async (b24Frame: B24Frame) => {
		B24 = b24Frame
		
		isInit.value = true
	})
})
// endregion ////

// region Parse File ////
const errorContainer = ref<string | null>(null);

const onFileChange = async (event: Event) => {
	const target = event.target as HTMLInputElement;
	if(target.files && target.files[0])
	{
		const file = target.files[0];
		const arrayBuffer = await file.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);
		
		// Преобразование из win1251 в utf8
		const buffer = Buffer.from(uint8Array);
		const decodedContent = iconv.decode(buffer, 'win1251');
		
		processFile(decodedContent);
	}
}

const myCompany = reactive({
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
	out: [],
});

function clear(): void
{
	myCompany.title = '';
	myCompany.accNumber = null;
	myCompany.currency.code = '';
	myCompany.currency.number = 0;
	myCompany.currCode = null;
	myCompany.type = 0;
	myCompany.bankName = '';
	myCompany.document.title = '';
	myCompany.in = [];
	myCompany.out = [];
}

const processFile = (content: string) =>
{
	try
	{
		clear()
		const parser = new ParserTxtFile(content, 'UTF-8');
		//const parser = new ParserTxtFile(content, 'windows-1251');
		
		const parsedData = parser.getResult();
		
		processMapping(parsedData)
	}
	catch(error: any)
	{
		alert(error);
		errorContainer.value = 'Ошибка при обработке файла: ' + (error?.message || error);
	}
}

const processMapping = (parsedData: any) =>
{
	myCompany.title = (parsedData.OUT_PARAM.header?.Header5 || '');
	myCompany.document.title = (parsedData.OUT_PARAM.header?.Header1 || '');
	myCompany.accNumber = parsedData.GENERAL.ACC;
	myCompany.type = parseInt(parsedData.GENERAL.TYPE);
	
	if(
		parsedData.OUT_PARAM?.wtf?.I3 === 'EUR'
		|| parseInt(parsedData.OUT_PARAM?.wtf?.I3) === 978
	)
	{
		myCompany.currency.number = 978;
		myCompany.currency.code = 'EUR';
	}
	else if(
		parsedData.OUT_PARAM?.wtf?.I3 === 'USD'
		|| parseInt(parsedData.OUT_PARAM?.wtf?.I3) === 840
	)
	{
		myCompany.currency.number = 840;
		myCompany.currency.code = 'USD';
	}
	else if(
		parsedData.OUT_PARAM?.wtf?.I3 === 'CNY'
		|| parseInt(parsedData.OUT_PARAM?.wtf?.I3) === 156
	)
	{
		myCompany.currency.number = 156;
		myCompany.currency.code = 'CNY';
	}
	else if(
		parsedData.OUT_PARAM?.wtf?.I3 === 'RUB'
		|| parseInt(parsedData.OUT_PARAM?.wtf?.I3) === 643
	)
	{
		myCompany.currency.number = 643;
		myCompany.currency.code = 'RUB';
	}
	else if(
		parsedData.OUT_PARAM?.wtf?.I3 === 'BYN'
		|| parseInt(parsedData.OUT_PARAM?.wtf?.I3) === 933
	)
	{
		myCompany.currency.number = 933;
		myCompany.currency.code = 'BYN';
	}
	else if(myCompany.currency.number === 933)
	{
		logger.error(new Error('Un Support currency'))
	}
	
	
	myCompany.bankName = parsedData.OUT_PARAM?.wtf?.MyBankName || '';
	
	(parsedData.OUT_PARAM?.items || []).forEach((row: any) => { parseRow(row) })
	
	myCompany.title = myCompany.title
		.replaceAll('*', ' ')
		.replace('Наименование счета', ' ')
		.replace('Наименование', ' ')
		.trim()
}

/**
 * Преобразуем строку в описание платежа
 * @param row
 */
function parseRow(row: any): any
{
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
		importStatus: null
	}
	
	let debit = 0.0
	let credit = 0.0
	
	if(!!row.Db)
	{
		debit = parseFloat(row.Db)
	}
	else if(!!row.DebQ)
	{
		debit = parseFloat(row.DebQ)
	}
	else if(!!row.Deb)
	{
		debit = parseFloat(row.Deb)
	}
	
	if(!!row.Credit)
	{
		credit = parseFloat(row.Credit)
	}
	else if(!!row.CreQ)
	{
		credit = parseFloat(row.CreQ)
	}
	else if(!!row.Cre)
	{
		credit = parseFloat(row.Cre)
	}
	
	if(debit > 0)
	{
		result.operation.isIn = false
		result.operation.sum = debit
	}
	else
	{
		result.operation.isIn = true
		result.operation.sum = credit
	}
	
	if(result.operation.isIn)
	{
		myCompany.in.push(result)
	}
	else
	{
		myCompany.out.push(result)
	}
}

const sumIn = computed(() => {
	return myCompany.in.reduce((currentValue, row) => {
		return (row?.operation?.sum || 0.0) + currentValue
	}, 0)
})

const sumOut = computed(() => {
	return myCompany.out.reduce((currentValue, row) => {
		return (row?.operation?.sum || 0.0) + currentValue
	}, 0)
})
// endregion ////

// region Actions ////

let result: IResult = reactive(new Result())

interface IStatus {
	isProcess: boolean,
	title: string,
	messages: string[],
	processInfo: null|string,
	resultInfo: null|string,
	progress: {
		animation: boolean,
		indicator: boolean,
		value: null|number,
		max: null|number
	}
}

const status: Ref<IStatus> = ref({
	isProcess: false,
	title: '',
	messages: [],
	processInfo: null,
	resultInfo: null,
	progress: {
		animation: false,
		indicator: true,
		value: 0,
		max: 0
	}
} as IStatus)

const reInitStatus = () => {
	result = reactive(new Result())
	
	status.value.isProcess = false
	status.value.title = 'Specify what we will test'
	status.value.messages = []
	status.value.processInfo = null
	status.value.resultInfo = null
	status.value.progress.animation = false
	status.value.progress.indicator = true
	status.value.progress.value = 0
	status.value.progress.max = 0
}

const stopMakeProcess = () => {
	status.value.isProcess = false
	status.value.processInfo = null
}

async function makeImportRows()
{
	return new Promise((resolve) => {
		reInitStatus()
		status.value.isProcess = true
		status.value.title = 'Загружаем выписку'
		
		status.value.progress.animation = true
		status.value.progress.indicator = false
		status.value.progress.value = null
		
		return resolve(null)
	})
	.then(() => {
		return Promise.all([
			... myCompany.in.map((row) => processRow(row, myCompany.currency.code, myCompany.accNumber)),
			... myCompany.out.map((row) => processRow(row, myCompany.currency.code, myCompany.accNumber)),
		])
	})
	.catch((error: Error|string) => {
		result.addError(error)
		logger.error(error)
	})
	.finally(() => {stopMakeProcess()})
}

const processRow = async (
	row: any,
	currency: string,
	myCompanyAccNumber: string,
): Promise<void> => {
	
	const rowXmlId = MD5([
		row.client.accNumber,
		row.document.num,
		row.operation.date,
		row.operation.sum,
		currency
	].join('-')).toString()
	
	
	return B24.callMethod(
		'crm.item.list',
		{
			entityTypeId: smartEntityTypeId,
			filter: {
				'=xmlId': rowXmlId
			},
			select: [
				'id',
				'xmlId',
				'*'
			]
		}
	)
	.then((response: Result) => {
		
		let data: any[] = response.getData().result?.items || []
		
		logger.info({
			rowXmlId,
			row,
			data
		})
		
		if(data.length > 0)
		{
			row.importStatus = (new Result()).setData({
				row: data[0]
			})
			
			return Promise.reject(new Error(
				'Эта запись была ранее импортирована'
			))
		}
		
		return B24.callMethod(
			'crm.item.add',
			{
				entityTypeId: smartEntityTypeId,
				fields: {
					xmlId: rowXmlId,
					title: `${row.operation.isIn ? 'Приход от' : 'Расход на'} ${row.client.name}`,
					opportunity: row.operation.sum,
					currencyId: currency,
					categoryId: row.operation.isIn ? OperationId.in : OperationId.out,
					ufCrm11RS: myCompanyAccNumber,
					ufCrm11Date: row.operation.date,
					ufCrm11Number: row.document.num,
					ufCrm11ClientRs: row.client.accNumber,
					ufCrm11Description: row.operation.description
				}
			}
		)
	})
	.then((response: Result) => {
		let data: any[] = response.getData().result.item
		
		logger.info({
			data
		})
		
		row.importStatus = (new Result()).setData({
			row: data
		})
	})
	.catch((error) => {
		row.importStatus.addError(error)
	})
}

const makeOpenRow = async (row: any) => {
	return B24.slider.openPath(
		B24.slider.getUrl(`/crm/type/${smartEntityTypeId}/details/${row.id}/`),
		950
	)
}

const problemMessageList = (result: IResult) => {
	let problemMessageList: string[] = [];
	const problem = result.getErrorMessages();
	if( typeof (problem || '') === 'string' )
	{
		problemMessageList.push(problem.toString());
	}
	else if(Array.isArray(problem))
	{
		problemMessageList = problemMessageList.concat(problem);
	}
	
	return problemMessageList;
}
// endregion ////
</script>

<template>
	<div
		v-if="!isInit"
		class="absolute top-0 bottom-0 left-0 right-0 flex flex-col justify-center items-center"
	>
		<div class="absolute z-10 text-info">
			<BtnSpinnerIcon class="size-44 stroke-1" />
		</div>
	</div>
	<div v-else class="flex flex-row flex-nowrap gap-4 min-h-full w-full">
		<div class="border border-gray-50 rounded-md w-1/4 p-5 overflow-hidden">
			<input type="file" @change="onFileChange" />
			
			<button
				type="button"
				class="mt-6 flex relative flex-row flex-nowrap gap-1.5 justify-center items-center uppercase rounded border border-base-500 pl-1 pr-3 py-2 text-sm font-medium text-base-700 hover:text-base-900 hover:bg-base-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-base-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-base-200 disabled:text-base-900 disabled:opacity-75"
				v-if="myCompany.accNumber"
				@click="makeImportRows"
				:disabled="status.isProcess"
			>
				<ImportIcon class="size-6"/>
				<div class="text-nowrap truncate">Загрузить</div>
			</button>
			
			<div
				class="mt-6 text-alert-text px-lg2 py-sm2 border border-base-30 rounded-md shadow-sm hover:shadow-md sm:rounded-md col-auto md:col-span-2 lg:col-span-1 bg-white"
				v-if="!result.isSuccess"
			>
				<h3 class="text-h5 font-semibold">Error</h3>
				<ul class="text-txt-md mt-sm2">
					<li v-for="(problem, index) in problemMessageList(result)" :key="index">{{ problem }}</li>
				</ul>
			</div>
			
			<div v-if="errorContainer" class="mt-6 text-alert-tex">{{ errorContainer }}</div>
		</div>
		
		<div class="border border-gray-50 rounded-md w-3/4 p-5  overflow-auto">
			<div v-if="myCompany.accNumber">
				<div class="mt-2 mb-4" v-show="status.isProcess">
					<div class="mt-2 pl-0.5 text-4xs text-blue-500" v-show="status.processInfo">{{ status.processInfo }}</div>
					<ProgressBar
						:animation="status.progress.animation"
						:indicator="status.progress.indicator"
						:value="status.progress?.value"
						:max="status.progress?.max || 0"
					></ProgressBar>
				</div>
				<div>
					<div class="px-4 sm:px-0">
						<h3 class="text-base font-semibold leading-5 text-gray-900">{{ myCompany.title }}</h3>
						<p class="mt-0.5 max-w-2xl text-sm leading-4 text-gray-500">{{ myCompany.document.title }}</p>
					</div>
					<div class="mt-6 border-t border-gray-100">
						<dl class="divide-y divide-gray-100">
							<div class="px-2 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
								<dt class="text-sm font-medium leading-6 text-gray-900">Банк</dt>
								<dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{{ myCompany.bankName }}</dd>
							</div>
							<div class="px-2 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
								<dt class="text-sm font-medium leading-6 text-gray-900">Р/сч</dt>
								<dd class="mt-1 text-md leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{{ formatterIban.printFormat(myCompany.accNumber) }} <span class="text-gray-500 text-sm" :title="myCompany.currency.number.toString()">{{ myCompany.currency.code }}</span></dd>
							</div>
							<div class="px-2 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
								<dt class="text-sm font-medium leading-6 text-gray-900">
									Приход
									<div class="font-medium text-success-background-on" v-if="myCompany.in.length > 0">{{ formatterNumber.format(sumIn) }}&nbsp;{{ myCompany.currency.code }}</div>
								</dt>
								<dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
									<ul
										v-if="myCompany.in.length > 0"
										role="list" class="divide-y divide-gray-100 rounded-md border border-gray-150"
									>
										<li
											class="py-2 pl-4 pr-5"
											v-for="(row, index) in myCompany.in"
											:key="index"
										>
											<div class="flex flex-col items-left justify-between text-sm leading-6">
												<div class="truncate text-gray-700">{{ row.client.name }}</div>
												<div class="truncate text-gray-700">УНП: {{ row.client.unp || '?' }} <span class="text-gray-500">Р/сч: {{ formatterIban.printFormat(row.client.accNumber) }}</span></div>
											</div>
											<div class="mt-1 flex items-start justify-between text-sm leading-2">
												<span class="line-clamp-3 text-gray-400 pr-2" :title="row.operation.description">{{ row.operation.description }}</span>
												<span class="flex-shrink-0 font-medium text-success-background-on"> {{ formatterNumber.format(row.operation.sum) }}&nbsp;{{ myCompany.currency.code }}</span>
											</div>
											<div
												v-if="row.importStatus !== null"
												class="mt-2 px-2 py-1 text-white rounded text-xs truncate w-full cursor-pointer"
												:class="[
													row.importStatus.isSuccess ? 'bg-green-700' : 'bg-red-500'
												]"
												@click="makeOpenRow(row.importStatus.getData().row)"
											>
												{{ row.importStatus.getData().row.title }}}
											</div>
										</li>
									</ul>
									<div v-else>
										Приходов нет
									</div>
								</dd>
							</div>
							<div class="px-2 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
								<dt class="text-sm font-medium leading-6 text-gray-900">
									Расход
									<div class="font-medium text-red-700" v-if="myCompany.out.length > 0">-{{ formatterNumber.format(sumOut) }}&nbsp;{{ myCompany.currency.code }}</div>
								</dt>
								<dd class="mt-2 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
									<ul
										v-if="myCompany.out.length > 0"
										role="list" class="divide-y divide-gray-100 rounded-md border border-gray-150"
									>
										<li
											class="py-3 pl-4 pr-5"
											v-for="(row, index) in myCompany.out"
											:key="index"
										>
											<div class="flex flex-col items-left justify-between text-sm leading-6">
												<div class="truncate text-gray-700">{{ row.client.name }}</div>
												<div class="truncate text-gray-700">УНП: {{ row.client.unp || '?' }} <span class="text-gray-500">Р/сч: {{ formatterIban.printFormat(row.client.accNumber) }}</span></div>
											</div>
											<div class="mt-1 flex items-start justify-between text-sm leading-2">
												<span class="line-clamp-2 text-gray-400 pr-2" :title="row.operation.description">{{ row.operation.description }}</span>
												<span class="flex-shrink-0 font-medium text-red-700">-{{ formatterNumber.format(row.operation.sum) }}&nbsp;{{ myCompany.currency.code }}</span>
											</div>
											<div
												v-if="row.importStatus !== null"
												class="mt-2 px-2 py-1 text-white rounded text-xs truncate w-full cursor-pointer"
												:class="[
													row.importStatus.isSuccess ? 'bg-green-700' : 'bg-red-500'
												]"
												@click="makeOpenRow(row.importStatus.getData().row)"
											>
												{{ row.importStatus.getData().row.title }}}
											</div>
										</li>
									</ul>
									<div v-else>
										Расходов нет
									</div>
								</dd>
							</div>
						</dl>
					</div>
				</div>
			</div>
			<div
				v-else
				class="flex flex-col w-full items-center justify-center text-gray-350"
			>
				<B24Icon name="Crm::CrmSearchIcon" class="size-20" />
				<div>Стоит загрузить файл</div>
			</div>
		</div>
	</div>
	
</template>