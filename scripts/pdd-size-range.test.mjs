import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {compileSizePlan,sizeDifferences} from './pdd-size-adapter.mjs'
import {resolveSizeDom} from './pdd-size-dom.mjs'
const input={scope:'pdd-tshirt-size-v1',productCode:'RANGE',kind:'body_recommendation',unit:'mixed',rows:[{size:'S',measurements:{height:{min:155,max:160},weight:{min:40,max:50}}}]}
test('range plans reject mixed modes and wrong units; readback checks both endpoints',()=>{
 const plan=compileSizePlan(input)
 assert.equal(sizeDifferences(plan,{rows:plan.rows}).length,0)
 const rows=structuredClone(plan.rows);rows[0].values['体重(kg)'].max='51'
 assert.equal(sizeDifferences(plan,{rows}).length,1)
 rows[0].values['体重(kg)'].max='';assert.equal(sizeDifferences(plan,{rows}).length,1)
 assert.throws(()=>compileSizePlan({...input,unit:'cm'}),/INVALID/)
 assert.throws(()=>compileSizePlan({...input,rows:[...input.rows,{size:'M',measurements:{height:165,weight:60}}]}),/INCONSISTENT/)
})
test('range DOM maps distinct lower and upper controls and rejects missing endpoint',()=>{
 const dom=new JSDOM(`<div data-testid="beast-core-form-item" id="newSpec"><label data-testid="beast-core-checkbox"><input type="checkbox" checked>身高(cm)</label><div data-testid="beast-core-table"><div data-testid="beast-core-table-middle-header"><table><tr><th>尺码</th><th>身高(cm)<label>区间值<input type="checkbox" checked></label></th><th>操作</th></tr></table></div><div data-testid="beast-core-table-middle-body"><table><tbody><tr><td>S</td><td><input value="155"><input value="160"></td><td></td></tr></tbody></table></div></div></div>`,{runScripts:'outside-only'})
 try{
 dom.window.HTMLElement.prototype.getClientRects=()=>[{}]
 const read=dom.window.eval(`(${resolveSizeDom.toString()})`),args={columns:['身高(cm)'],sizes:['S']}
 assert.equal(read(args).ranges['身高(cm)'],true)
 assert.equal(read({...args,target:{size:'S',measurement:'身高(cm)',bound:'max'}}).value,'160')
 assert.equal(read({...args,target:{rangeColumn:'身高(cm)'}}).checked,true)
 dom.window.document.querySelector('tbody td input').remove()
 assert.throws(()=>read(args),/SIZE_CELL_AMBIGUOUS/)
 }finally{dom.window.close()}
})
