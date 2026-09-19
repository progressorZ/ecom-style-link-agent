import {describe,expect,it} from 'vitest'
import {pasteVariantTable} from './variant-bulk'
import type {DraftVariant} from './listing-draft'

const rows:DraftVariant[]=[
 {color:'黑白',size:'35',merchantSku:'A-C01-35',groupPrice:'',singlePrice:'',stock:'',enabled:true},
 {color:'米白',size:'36',merchantSku:'A-C02-36',groupPrice:'88',singlePrice:'98',stock:'5',enabled:true}
]
describe('通用规格表格粘贴',()=>{
 it('按颜色和鞋码匹配，不依赖行顺序',()=>{const result=pasteVariantTable(rows,'颜色\t鞋码\t拼单价\t单买价\t库存\n米白\t36\t99\t109\t20\n黑白\t35\t89\t99\t10');expect(result.changes).toBe(6);expect(result.variants[0]).toMatchObject({groupPrice:'89',singlePrice:'99',stock:'10'});expect(result.variants[1]).toMatchObject({groupPrice:'99',singlePrice:'109',stock:'20'})})
 it('拒绝当前规格不存在的行',()=>{expect(()=>pasteVariantTable(rows,'颜色,鞋码,库存\n黑色,99,10')).toThrow('不在当前规格表')})
})
