import {readFile,readdir} from 'node:fs/promises'
import {dirname,join,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const maturity={proposal:0,experimental:1,beta:2,stable:3,deprecated:4}
const normalizedLabel=value=>String(value??'').replace(/[（(](?:cm|mm|kg|g|元|件)[）)]$/i,'').trim()
const duplicateValues=values=>[...new Set(values.filter((value,index)=>values.indexOf(value)!==index))]

export function validateRepositoryContracts({registry,contracts,adapters}){
 const errors=[]
 const profiles=new Map()
 for(const profile of registry?.profiles??[]){
  if(profiles.has(profile.id))errors.push(`Profile ID 重复：${profile.id}`)
  profiles.set(profile.id,profile)
 }
 const categoryKeys=(registry?.profiles??[]).map(profile=>profile.categoryKey)
 for(const key of duplicateValues(categoryKeys))errors.push(`Profile categoryKey 重复：${key}`)

 for(const {file,contract} of contracts){
  const prefix=`${file}: `,profile=profiles.get(contract.profileId)
  if(!profile){errors.push(prefix+`引用未知 Profile：${contract.profileId}`);continue}
  const fieldKeys=contract.fields.map(field=>field.internalKey)
  for(const key of duplicateValues(fieldKeys))errors.push(prefix+`字段 internalKey 重复：${key}`)
  const dimensionKeys=contract.variantDimensions.map(dimension=>dimension.internalKey)
  for(const key of duplicateValues(dimensionKeys))errors.push(prefix+`规格维度 internalKey 重复：${key}`)
  for(const dimension of contract.variantDimensions){
   for(const option of duplicateValues(dimension.options??[]))errors.push(prefix+`${dimension.internalKey} 选项重复：${option}`)
  }
  const fields=new Map(contract.fields.map(field=>[field.internalKey,field]))
  for(const attribute of profile.attributeFields){
   const field=fields.get(attribute.key)
   if(!field){errors.push(prefix+`缺少 Profile 属性字段：${attribute.key}`);continue}
   if(typeof field.workbenchRequired!=='boolean')errors.push(prefix+`${attribute.key} 缺少 workbenchRequired，无法区分工作台完整性要求与平台必填`)
   else if(field.workbenchRequired!==attribute.required)errors.push(prefix+`${attribute.key} workbenchRequired=${field.workbenchRequired} 与 Profile required=${attribute.required} 不一致`)
   if(normalizedLabel(field.platformLabel)!==normalizedLabel(attribute.label))errors.push(prefix+`${attribute.key} 标签不一致：Profile「${attribute.label}」/ 页面合同「${field.platformLabel}」`)
  }
  if(contract.executionEnabled){
   if(!contract.verifiedAt)errors.push(prefix+'executionEnabled=true 时 verifiedAt 不能为空')
   for(const field of contract.fields.filter(field=>field.required===true))if(field.status!=='readback-verified')errors.push(prefix+`平台必填字段 ${field.internalKey} 尚未完成 readback-verified`)
   for(const dimension of contract.variantDimensions)if(dimension.status!=='readback-verified')errors.push(prefix+`规格维度 ${dimension.internalKey} 尚未完成 readback-verified`)
   if(!contract.evidence.some(item=>item.kind==='test-report'))errors.push(prefix+'executionEnabled=true 时必须包含 test-report 证据')
  }
  const matches=adapters.flatMap(({file:adapterFile,manifest})=>manifest.platform.id===profile.platform?manifest.categories.filter(category=>category.key===profile.categoryKey).map(category=>({adapterFile,manifest,category})):[])
  if(!matches.length){errors.push(prefix+`没有 Adapter 声明平台 ${profile.platform} / 类目 ${profile.categoryKey}`);continue}
  for(const {adapterFile,manifest,category} of matches){
   if(category.displayPath!==profile.categoryPath)errors.push(`${adapterFile}: ${profile.categoryKey} 路径与 Profile 不一致`)
   if(maturity[category.status]>maturity[profile.status])errors.push(`${adapterFile}: ${profile.categoryKey} 成熟度 ${category.status} 高于 Profile ${profile.status}`)
   if(contract.verifiedAt&&(!category.lastVerifiedAt||category.lastVerifiedAt<contract.verifiedAt))errors.push(`${adapterFile}: ${profile.categoryKey} lastVerifiedAt 早于页面合同 ${contract.verifiedAt}`)
  }
 }
 return errors
}

export async function loadRepositoryContracts(base=root){
 const registry=JSON.parse(await readFile(join(base,'config/category-profiles.json'),'utf8'))
 const contracts=[]
 for(const platform of await readdir(join(base,'config'),{withFileTypes:true})){
  if(!platform.isDirectory())continue
  for(const name of await readdir(join(base,'config',platform.name))){
   if(!name.endsWith('.json'))continue
   const file=`config/${platform.name}/${name}`,value=JSON.parse(await readFile(join(base,file),'utf8'))
   if(value?.schemaVersion==='1.0'&&typeof value.profileId==='string')contracts.push({file,contract:value})
  }
 }
 const adapters=[]
 for(const entry of await readdir(join(base,'adapters'),{withFileTypes:true})){
  if(!entry.isDirectory())continue
  const file=`adapters/${entry.name}/adapter.json`,manifest=JSON.parse(await readFile(join(base,file),'utf8'))
  adapters.push({file,manifest})
 }
 return {registry,contracts,adapters}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const errors=validateRepositoryContracts(await loadRepositoryContracts())
 if(errors.length){console.error(errors.map(error=>`- ${error}`).join('\n'));process.exit(1)}
 console.log('Profile、页面合同与 Adapter 跨文件语义检查通过。')
}
