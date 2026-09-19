import {unzipSync} from 'fflate'

export type ListingSheetRow={color:string;size:string;groupPrice:string;singlePrice:string;stock:string}
export type ListingSheet={productCode:string;title:string;brand:string;referencePrice:string;discount:string;attributes:Record<string,string>;rows:ListingSheetRow[]}

const clean=(value:unknown)=>String(value??'').trim()
const header=(value:unknown)=>clean(value).replace(/^\uFEFF/,'').replace(/[（）]/g,c=>c==='（'?'(':')').replace(/\s/g,'')
const columnIndex=(reference:string)=>{let result=0;for(const c of reference.match(/[A-Z]+/)?.[0]??'')result=result*26+c.charCodeAt(0)-64;return result-1}
const xml=(value:Uint8Array)=>new DOMParser().parseFromString(new TextDecoder().decode(value),'application/xml')

function xlsxRows(bytes:Uint8Array):string[][]{
 if(bytes.length>10_000_000)throw new Error('Excel 文件不能超过 10MB')
 const files=unzipSync(bytes,{filter:file=>file.name==='xl/sharedStrings.xml'||/^xl\/worksheets\/sheet\d+\.xml$/.test(file.name)})
 const inflated=Object.values(files).reduce((sum,file)=>sum+file.length,0)
 if(inflated>30_000_000)throw new Error('Excel 解压后的数据过大，请只保留当前商品工作表')
 const sheetName=Object.keys(files).filter(name=>/^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort((a,b)=>Number(a.match(/\d+/)?.[0])-Number(b.match(/\d+/)?.[0]))[0]
 if(!sheetName)throw new Error('Excel 中没有可读取的工作表')
 const shared=files['xl/sharedStrings.xml']?Array.from(xml(files['xl/sharedStrings.xml']).querySelectorAll('si')).map(item=>Array.from(item.querySelectorAll('t')).map(node=>node.textContent??'').join('')):[]
 const document=xml(files[sheetName]),rows:string[][]=[]
 for(const row of Array.from(document.querySelectorAll('sheetData > row'))){
  const values:string[]=[]
  for(const cell of Array.from(row.querySelectorAll(':scope > c'))){
   const index=columnIndex(cell.getAttribute('r')??'A1'),type=cell.getAttribute('t'),raw=cell.querySelector('v')?.textContent??''
   values[index]=type==='s'?shared[Number(raw)]??'':type==='inlineStr'?Array.from(cell.querySelectorAll('is t')).map(node=>node.textContent??'').join(''):raw
  }
  rows.push(Array.from({length:Math.max(values.length,1)},(_,index)=>clean(values[index])))
 }
 return rows
}

function delimitedRows(text:string):string[][]{
 const delimiter=text.includes('\t')?'\t':',',rows:string[][]=[];let row:string[]=[],value='',quoted=false
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++}else quoted=false}else value+=c;continue}if(c==='"'&&!value){quoted=true;continue}if(c===delimiter||c==='\n'||c==='\r'){row.push(clean(value));value='';if(c!==delimiter){if(row.some(Boolean))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++}}else value+=c}
 if(quoted)throw new Error('CSV 引号不完整');row.push(clean(value));if(row.some(Boolean))rows.push(row);return rows
}

export async function readSpreadsheet(file:File):Promise<string[][]>{
 if(file.size>10_000_000)throw new Error('表格文件不能超过 10MB')
 const lower=file.name.toLowerCase()
 if(lower.endsWith('.xlsx'))return xlsxRows(new Uint8Array(await file.arrayBuffer()))
 if(lower.endsWith('.csv')||lower.endsWith('.tsv'))return delimitedRows(await file.text())
 throw new Error('请选择 .xlsx、.csv 或 .tsv 文件；旧版 .xls 请先在 Excel/WPS 中另存为 .xlsx')
}

export function parseListingSheet(matrix:string[][],attributeLabels:Record<string,string>={}):ListingSheet{
 const rows=matrix.filter(row=>row.some(value=>clean(value)));if(rows.length<2)throw new Error('表格必须包含表头和至少一行规格数据')
 const headers=rows[0].map(header),index=(...aliases:string[])=>headers.findIndex(value=>aliases.map(header).includes(value)),value=(row:string[],...aliases:string[])=>{const i=index(...aliases);return i<0?'':clean(row[i])}
 const color=index('颜色','颜色分类'),size=index('尺码','鞋码'),group=index('拼单价','拼单价(元)'),single=index('单买价','单买价(元)'),stock=index('库存','库存(件)')
 if([color,size,group,single,stock].some(i=>i<0))throw new Error('表头必须包含：颜色、尺码/鞋码、拼单价、单买价、库存')
 const variants:ListingSheetRow[]=[],seen=new Set<string>()
 rows.slice(1).forEach((row,offset)=>{const item={color:clean(row[color]),size:clean(row[size]),groupPrice:clean(row[group]),singlePrice:clean(row[single]),stock:clean(row[stock])},key=`${item.color}\0${item.size}`;if(!item.color||!item.size)throw new Error(`第 ${offset+2} 行缺少颜色或尺码`);if(seen.has(key))throw new Error(`第 ${offset+2} 行重复：${item.color}/${item.size}`);seen.add(key);variants.push(item)})
 const first=rows.slice(1),firstValue=(...aliases:string[])=>first.map(row=>value(row,...aliases)).find(Boolean)??'',attributes:Record<string,string>={}
 for(const [key,label] of Object.entries(attributeLabels)){const found=firstValue(label,key);if(found)attributes[key]=found}
 return {productCode:firstValue('商品货号','货号','款式编号'),title:firstValue('商品标题','标题'),brand:firstValue('品牌'),referencePrice:firstValue('参考价','商品参考价','参考价(元)'),discount:firstValue('满2件折扣','满二件折扣'),attributes,rows:variants}
}
