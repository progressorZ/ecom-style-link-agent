import {describe,expect,it} from 'vitest'
import {boardShoesProfile} from './category-profile'
import {buildVariantMatrix,compileListingDraft,createListingDraft,regenerateVariantSkus,validateListingDraft} from './listing-draft'

describe('通用类目商品草稿',()=>{
  it('按照颜色和鞋码生成规格，并保留已有价格库存',()=>{
    const draft=createListingDraft(boardShoesProfile)
    draft.productCode='SHOE-001'
    draft.colors='黑白,米白'
    draft.sizes='35,36'
    draft.variants=buildVariantMatrix(draft)
    draft.variants[0]={...draft.variants[0],groupPrice:'99',singlePrice:'109',stock:'20'}
    draft.sizes='35,36,37'
    const next=buildVariantMatrix(draft)
    expect(next).toHaveLength(6)
    expect(next[0]).toMatchObject({color:'黑白',size:'35',groupPrice:'99',singlePrice:'109',stock:'20'})
    expect(next[2].merchantSku).toBe('SHOE-001-C01-37')
  })

  it('在真实页面合同未验证前只能导出草稿，不能执行',()=>{
    const draft=createListingDraft(boardShoesProfile)
    draft.productCode='SHOE-002'
    draft.title='低帮系带板鞋'
    draft.brand='无品牌'
    for(const field of boardShoesProfile.attributeFields)if(field.required)draft.attributes[field.key]='待映射值'
    draft.variants=buildVariantMatrix(draft).map(row=>({...row,groupPrice:'99',singlePrice:'109',stock:'10'}))
    draft.mainImages=[{name:'front.jpg',path:'/tmp/front.jpg'}]
    draft.colorImages=Object.fromEntries(draft.colors.split(',').map((color,index)=>[color,{name:`color-${index + 1}.jpg`,path:`/tmp/color-${index + 1}.jpg`}]))
    expect(validateListingDraft(draft).filter(issue=>issue.kind==='blocking')).toEqual([])
    const output=compileListingDraft(draft)
    expect(output.execution.enabled).toBe(false)
    expect(output.validation.verification.length).toBeGreaterThan(0)
  })
  it('复制为新商品时保留价格库存并重建规格编码',()=>{const draft=createListingDraft(boardShoesProfile);draft.productCode='OLD-001';draft.colors='黑白';draft.sizes='35';draft.variants=buildVariantMatrix(draft).map(row=>({...row,groupPrice:'99',singlePrice:'109',stock:'10'}));const next=regenerateVariantSkus(draft,'NEW-002');expect(next[0]).toMatchObject({merchantSku:'NEW-002-C01-35',groupPrice:'99',singlePrice:'109',stock:'10'})})
})
