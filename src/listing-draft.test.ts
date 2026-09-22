import {describe,expect,it} from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import {boardShoesProfile} from './category-profile'
import {buildFootwearSizeChart,buildVariantMatrix,compileListingDraft,createListingDraft,importCompiledListingDraft,normalizeListingDraft,regenerateVariantSkus,validateListingDraft,type ListingDraft} from './listing-draft'
import listingDraftSchema from '../schemas/listing-draft-export.schema.json'

function completeDraft():ListingDraft{
 const draft=createListingDraft(boardShoesProfile)
 draft.productCode='SHOE-002';draft.title='低帮系带板鞋';draft.brand='无品牌';draft.colors='黑白,米白';draft.sizes='26,27'
 for(const field of boardShoesProfile.attributeFields)if(field.required)draft.attributes[field.key]='已核对值'
 draft.variants=buildVariantMatrix(draft).map(row=>({...row,groupPrice:'99',singlePrice:'109',stock:'10'}))
 draft.referencePrice='139';draft.discount='9.5';draft.sizeChart=buildFootwearSizeChart(draft).map((row,index)=>({...row,footLengthMin:String(165+index*7)}))
 draft.mainImages=[{name:'front.jpg',path:'/tmp/123e4567-e89b-12d3-a456-426614174000.jpg'}]
 draft.colorImages=Object.fromEntries(draft.colors.split(',').map((color,index)=>[color,{name:`color-${index+1}.jpg`,path:`/tmp/123e4567-e89b-12d3-a456-42661417400${index}.jpg`}]))
 return draft
}

describe('通用类目商品草稿',()=>{
 it('按照颜色和鞋码生成规格，并保留已有价格库存',()=>{
  const draft=createListingDraft(boardShoesProfile)
  draft.productCode='SHOE-001';draft.colors='黑白,米白';draft.sizes='35,36';draft.variants=buildVariantMatrix(draft)
  draft.variants[0]={...draft.variants[0],groupPrice:'99',singlePrice:'109',stock:'20'};draft.sizes='35,36,37'
  const next=buildVariantMatrix(draft)
  expect(next).toHaveLength(6)
  expect(next[0]).toMatchObject({color:'黑白',size:'35',groupPrice:'99',singlePrice:'109',stock:'20'})
  expect(next[2].merchantSku).toBe('SHOE-001-C01-37')
 })

 it('完整资料可以导出，但自动执行保持关闭',()=>{
  const draft=completeDraft()
  expect(validateListingDraft(draft).filter(issue=>issue.kind==='blocking')).toEqual([])
  const output=compileListingDraft(draft)
  expect(output.execution.enabled).toBe(false)
  expect(output.validation.verification.length).toBeGreaterThan(0)
  expect(JSON.stringify(output)).not.toContain('/tmp/')
  const validate=new Ajv2020({allErrors:true,strict:true}).compile(listingDraftSchema)
  expect(validate(output),JSON.stringify(validate.errors)).toBe(true)
 })

 it('复制为新商品时保留价格库存并重建规格编码',()=>{
  const draft=createListingDraft(boardShoesProfile);draft.productCode='OLD-001';draft.colors='黑白';draft.sizes='35';draft.variants=buildVariantMatrix(draft).map(row=>({...row,groupPrice:'99',singlePrice:'109',stock:'10'}))
  expect(regenerateVariantSkus(draft,'NEW-002')[0]).toMatchObject({merchantSku:'NEW-002-C01-35',groupPrice:'99',singlePrice:'109',stock:'10'})
 })

 it('拒绝同数量但组合错误或重复的规格矩阵',()=>{
  const draft=completeDraft();draft.variants[1]={...draft.variants[0],merchantSku:'OTHER'}
  expect(validateListingDraft(draft).some(issue=>issue.field==='variants'&&issue.message.includes('缺失、重复'))).toBe(true)
 })

 it('鞋码集合变化时要求重建尺码表，即使行数相同',()=>{
  const draft=completeDraft();draft.sizes='26,28';draft.variants=buildVariantMatrix(draft)
  expect(validateListingDraft(draft).some(issue=>issue.field==='sizeChart'&&issue.message.includes('顺序不一致'))).toBe(true)
 })

 it('演示资料不能导出',()=>{
  const draft=completeDraft();draft.sample=true
  expect(()=>compileListingDraft(draft)).toThrow('不能导出')
 })

 it('旧草稿会补齐新字段并过滤损坏结构',()=>{
  const migrated=normalizeListingDraft({profileId:boardShoesProfile.id,productCode:'OLD',attributes:'bad',variants:'bad',services:[],mainImages:[null,{name:'a.jpg',path:'/tmp/a.jpg'}]},boardShoesProfile)
  expect(migrated.schemaVersion).toBe('2.0')
  expect(migrated.variants).toEqual([])
  expect(migrated.attributes.upperMaterial).toBe('')
  expect(migrated.services.groupSize).toBe(2)
  expect(migrated.mainImages).toHaveLength(1)
 })

 it('导出 JSON 可以回导，素材使用稳定编号',()=>{
  const original=completeDraft(),exported=compileListingDraft(original),restored=importCompiledListingDraft(exported,boardShoesProfile)
  expect(restored.productCode).toBe(original.productCode)
  expect(restored.variants).toEqual(original.variants)
  expect(restored.sizeChart).toEqual(original.sizeChart)
  expect(restored.mainImages[0].assetId).toBe('123e4567-e89b-12d3-a456-426614174000.jpg')
 })

 it('中文自定义鞋码会生成稳定且不同的 SKU',()=>{
  const draft=createListingDraft(boardShoesProfile);draft.productCode='SHOE-CN';draft.colors='黑色';draft.sizes='七码,八码'
  const rows=buildVariantMatrix(draft)
  expect(rows[0].merchantSku).not.toBe(rows[1].merchantSku)
  expect(rows.every(row=>row.merchantSku.includes('SIZE-'))).toBe(true)
 })

 it('修改货号时只重编现有 SKU，不依赖仍在编辑中的颜色文本',()=>{
  const draft=completeDraft();draft.colors=''
  const rows=regenerateVariantSkus(draft,'NEW-003')
  expect(rows).toHaveLength(draft.variants.length)
  expect(new Set(rows.map(row=>row.merchantSku)).size).toBe(rows.length)
  expect(rows.every(row=>row.merchantSku.startsWith('NEW-003-'))).toBe(true)
 })

 it('没有稳定素材编号的旧路径会要求重新选择图片',()=>{
  const draft=completeDraft();draft.mainImages=[{name:'front.jpg',path:'/tmp/front.jpg'}]
  expect(validateListingDraft(draft)).toContainEqual(expect.objectContaining({field:'mainImages',kind:'blocking'}))
 })
})
