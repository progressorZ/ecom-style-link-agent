import {it,expect} from 'vitest'
import {starterProduct} from './starter-product'
import {collectFormIssues,buildPackage,switchSizeKind,copyAsNewProduct} from './mvp-form'
import {templateForm} from './product-templates'
const images={main:[{name:'front',path:'/tmp/front.png'}],detail:[{name:'back',path:'/tmp/back.png'}],sku:{name:'front',path:'/tmp/front.png'}}
it('starter includes complete fields and both chart modes without claiming confirmation',()=>{
 const form=starterProduct({id:'intro',productCode:'INTRO-1'},images)
 expect(form.rows).toHaveLength(6);expect(collectFormIssues(form)).toEqual([]);expect(form.confirmed).toBe(false);expect(form.sample).toBe(true)
 expect(Object.keys(form.skuImages)).toEqual(['白色','黑色'])
 expect(()=>buildPackage(form,'s','p')).toThrow(/确认/)
 form.confirmed=true;expect(buildPackage(form,'s','p').variants).toHaveLength(6)
 const body=switchSizeKind(form,'body_recommendation');expect(collectFormIssues(body)).toEqual([]);expect(body.measurements.S.weight).toBe('40-50');expect(body.rangeFields).toEqual(['height','weight'])
 expect(copyAsNewProduct(form,{id:'new',productCode:'NEW-1'}).sample).toBe(true)
 expect(templateForm(form).sample).toBe(true)
 form.main[0].name='changed';expect(images.main[0].name).toBe('front')
})
