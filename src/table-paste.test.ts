import {it,expect} from 'vitest'
import {blankForm,rebuildRows,collectFormIssues} from './mvp-form'
import {pastePrices,pasteMeasurements} from './table-paste'
import {changeAttribute,attributeChoices} from './attribute-choices'
function form(){const f=blankForm('id');f.productCode='A-1';f.colors='白色,黑色';f.sizes='S,M';f.rows=rebuildRows(f).map(r=>({...r,groupPrice:'90',singlePrice:'100',stock:'5'}));return f}
it('matches reversed rows, changes only supplied columns and never mutates original',()=>{
 const f=form(),result=pastePrices(f,'尺码\t颜色\t库存\nM\t黑色\t12\nS\t白色\t0')
 expect(result.form.rows.find(r=>r.color==='黑色'&&r.size==='M')?.stock).toBe('12')
 expect(result.form.rows[0].stock).toBe('0');expect(result.form.rows[0].singlePrice).toBe('100');expect(f.rows[0].stock).toBe('5')
 expect(result.changes).toHaveLength(2)
})
it('rejects ambiguous rows, blanks, extra columns and invalid prices without changing input',()=>{
 const f=form()
 for(const text of ['颜色,尺码,库存\n白色,S,','颜色,尺码,库存\n白色,S,3\n白色,S,4','颜色,尺码,库存\n蓝色,S,3','颜色,尺码,售价\n白色,S,3','颜色,尺码,单买价\n白色,S,1'])expect(()=>pastePrices(f,text)).toThrow()
 expect(f.rows[0].stock).toBe('5')
 expect(pastePrices(f,'"颜色","尺码","库存"\r\n"白色","S","9"').form.rows[0].stock).toBe('9')
})
it('size paste detects bound columns, correct units and all current size rows',()=>{
 const f=form();f.sizeKind='body_recommendation';f.sizeFields=['height','weight']
 const pasted=pasteMeasurements(f,'尺码\t身高下限(cm)\t身高上限(cm)\t体重(kg)\nM\t160\t165\t50-60\nS\t155\t160\t40-50')
 expect(pasted.form.measurements.S).toEqual({height:'155-160',weight:'40-50'});expect(pasted.form.rangeFields).toEqual(['height','weight'])
 expect(()=>pasteMeasurements(f,'尺码,体重(斤)\nS,80\nM,90')).toThrow()
 expect(()=>pasteMeasurements(f,'尺码,身高(cm)\nS,160')).toThrow(/缺少/)
 expect(()=>pasteMeasurements(f,'尺码,身高(cm)\nS,170-160\nM,170')).toThrow(/下限/)
 expect(()=>pasteMeasurements(f,'尺码,身高(cm)\nS,160-170\nM,170')).toThrow(/模式/)
})
it('collects simultaneous missing facts and clears only changed attribute dependencies',()=>{
 const f=form(),issues=collectFormIssues(f)
 expect(issues.some(i=>i.field==='title')).toBe(true);expect(issues.some(i=>i.field==='brand')).toBe(true);expect(issues.some(i=>i.field==='images')).toBe(true);expect(issues.some(i=>i.field.startsWith('measurement:'))).toBe(true)
 f.attributes={fabricName:'棉',material:'棉',composition:'95%及以上',primaryStyle:'简约通勤',secondaryStyle:'简约'}
 expect(attributeChoices(f.attributes,'composition')).toContain('95%及以上')
 const changed=changeAttribute(f,'fabricName','供应商新面料');expect(changed.attributes.material).toBe('');expect(changed.attributes.composition).toBe('');expect(changed.attributes.secondaryStyle).toBe('简约');expect(attributeChoices(changed.attributes,'composition')).toEqual([])
 expect(changeAttribute(f,'primaryStyle','新风格').attributes.secondaryStyle).toBe('')
})

it('price paste preserves legacy codes, ordering and enabled state',()=>{
 const f=form();f.rows.reverse();f.rows[0].merchantSku='LEGACY-CODE';f.rows[0].enabled=false;f.rows[0].stock='0'
 const result=pastePrices(f,'颜色,尺码,库存\n白色,S,8')
 expect(result.form.rows[0].merchantSku).toBe('LEGACY-CODE');expect(result.form.rows[0].enabled).toBe(false);expect(result.form.rows[0].stock).toBe('0')
 expect(result.form.rows.map(r=>r.merchantSku)).toEqual(f.rows.map(r=>r.merchantSku))
 f.colors='白色';expect(()=>pastePrices(f,'颜色,尺码,库存\n白色,S,8')).toThrow(/先更新/)
})
it('malformed quotes cannot silently concatenate or alter numeric input',()=>{
 for(const value of ['"1"2','1"2"','"1" "2"'])expect(()=>pastePrices(form(),'颜色,尺码,库存\n白色,S,'+value)).toThrow(/引号/)
 expect(pastePrices(form(),'颜色,尺码,库存\n白色,S,"12" ').form.rows[0].stock).toBe('12')
})
it('duplicate sizes and image paths appear before package submission',()=>{
 const f=form();f.sizes='S,s';f.main=[{path:'/tmp/a.png',name:'a'},{path:'/tmp/a.png',name:'a'}];f.shipping='invalid'
 const issues=collectFormIssues(f)
 expect(issues.some(i=>i.field==='colors'&&i.message.includes('重复'))).toBe(true)
 expect(issues.some(i=>i.field==='images'&&i.message.includes('重复'))).toBe(true)
 expect(issues.some(i=>i.field==='shipping')).toBe(true)
})
