import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {blankForm,buildPackage,rebuildRows,formFromPackage,copyAsNewProduct,generatedSkuCode,regenerateSkuCodes,updateForm,setReuseCheck,reuseConfirmed,applySizeTemplate,applyProductTemplate,switchSizeKind} from '../src/mvp-form.ts'
import {compileProductPackage} from './pdd-package-plan.mjs'
import {createLiveServer} from './live-server.mjs'
const fixture=JSON.parse(await readFile(new URL('../examples/product-package-tshirt-acceptance-v3.json',import.meta.url)))
function form(colors='白色',sizes='S,M'){
 const f=blankForm('mvp-test-id');Object.assign(f,{productCode:'MVP-TEST-01',title:'虚构验收商品勿上架',brand:fixture.product.brand,colors,sizes,referencePrice:'200',discount:'9.4',confirmed:true})
 f.attributes=Object.fromEntries(Object.entries(fixture.product.attributes).map(([k,v])=>[k,Array.isArray(v)?v.join(','):v]))
 f.rows=rebuildRows(f).map((r,i)=>({...r,groupPrice:(100+i+.01).toFixed(2),singlePrice:(120+i+.02).toFixed(2),stock:String(i)}))
 for(const size of sizes.split(','))f.measurements[size]={shoulder:'37',chest:'86'}
 f.main=[{name:'front.png',path:fixture.assets[0].sourcePath}];f.detail=[{name:'back.png',path:fixture.assets[1].sourcePath}]
 for(const color of colors.split(','))f.skuImages[color]={name:'front.png',path:fixture.assets[0].sourcePath}
 return f
}
test('three single-product shapes compile with exact per-SKU prices, stock and bindings',()=>{
 for(const [colors,sizes] of [['白色','S,M'],['白色,黑色','S,M'],['白色','S,M,L']]){
 const f=form(colors,sizes),p=buildPackage(f,'test-shop','logistics'),plan=compileProductPackage(p)
 assert.equal(plan.steps.find(s=>s.id==='matrixAndSku').input.variants.length,f.rows.length)
 p.listing.offers.forEach((o,i)=>{assert.equal(o.stock,i);assert.equal(o.prices[0].amountMinor,10001+i*100);assert.equal(o.prices[1].amountMinor,12002+i*100);assert.equal(p.assets.find(a=>a.id===o.skuAssetId).colorKey,p.variants[i].colorKey)})
 }
})
test('blank/invalid/changed SKU facts never become implicit zero or stale rows',()=>{
 const f=form();f.rows[0].stock='';assert.throws(()=>buildPackage(f,'s','p'),/库存/)
 f.rows[0].stock='0';f.rows[0].groupPrice='';assert.throws(()=>buildPackage(f,'s','p'),/金额/)
 f.rows[0].groupPrice='99.999';assert.throws(()=>buildPackage(f,'s','p'),/两位小数/)
 f.rows[0].groupPrice='99';f.colors='白色,黑色';assert.throws(()=>buildPackage(f,'s','p'),/重新生成/)
 f.colors='白色,白色';assert.throws(()=>rebuildRows(f),/重复/)
 f.colors='白色';f.confirmed=false;assert.throws(()=>buildPackage(f,'s','p'),/勾选确认/)
 const fresh=blankForm('another-id');assert.equal(fresh.productCode,'');assert.deepEqual(fresh.rows,[]);assert.deepEqual(fresh.main,[])
})
test('restoring an existing product preserves identity and business facts but requires new confirmation',()=>{
 const f=form('白色,黑色'),pkg=buildPackage(f,'shop','freight'),restored=formFromPackage(pkg)
 assert.equal(restored.id,f.id);assert.equal(restored.productCode,f.productCode);assert.equal(restored.confirmed,false)
 restored.confirmed=true;const rebuilt=buildPackage(restored,'shop','freight',pkg.listing.inventoryConfirmedAt)
 assert.deepEqual(rebuilt,pkg)
})
test('copying as a new product retains reusable facts and regenerates internal identity and SKU codes',()=>{
 const original=form('白色,黑色'),copy=copyAsNewProduct(original,{id:'new-product-id',productCode:'A20260912-001'})
 assert.equal(copy.id,'new-product-id');assert.equal(copy.productCode,'A20260912-001');assert.equal(copy.confirmed,false)
 assert.deepEqual(copy.attributes,original.attributes);assert.deepEqual(copy.measurements,original.measurements);assert.deepEqual(copy.main,original.main);assert.deepEqual(copy.detail,original.detail);assert.deepEqual(copy.skuImages,original.skuImages)
 assert.deepEqual(copy.rows.map(r=>r.merchantSku),['A20260912-001-WHT-S','A20260912-001-WHT-M','A20260912-001-BLK-S','A20260912-001-BLK-M'])
 copy.reuse.checks={priceStock:true,images:true,sizes:true};copy.confirmed=true
 assert.equal(buildPackage(copy,'shop','freight').variants[0].merchantSku,'A20260912-001-WHT-S')
 assert.equal(generatedSkuCode('A-1','自定义色','均码',0),'A-1-C01-U5747_7801')
 copy.productCode='SUPPLIER-88';assert.ok(regenerateSkuCodes(copy).every(r=>r.merchantSku.startsWith('SUPPLIER-88-')))
})
test('real form API configures without JSON package, validates files and persists isolated source',async()=>{
 const root=await mkdtemp(join(tmpdir(),'mvp-entry-')),app=createLiveServer({root,launch:()=>{throw new Error('must not open merchant browser')}})
 await app.ready;await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}/api/live/`
 const post=(path,data)=>fetch(base+path,{method:'POST',headers:{origin:'http://127.0.0.1:5173','content-type':'application/json'},body:JSON.stringify(data)})
 try{
 assert.equal((await post('entry',{form:form()})).status,400)
 const settings={mallId:'123',shopName:'测试店铺',templateName:'测试运费模板',groups:'包邮配送区域 北京\n不配送区域 香港',confirmed:true}
 assert.equal((await post('settings',{...settings,confirmed:false})).status,400)
 assert.equal((await post('settings',settings)).status,200)
 assert.equal((await(await fetch(base+'entry')).json()).settings.shopName,'测试店铺')
 const template={id:'size-1',name:'测试尺码模板',fields:['shoulder','waist'],measurements:{S:{shoulder:'37',waist:'70'}}}
 assert.equal((await post('size-templates',{template:{...template,fields:[]}})).status,400)
 assert.equal((await post('size-templates',{template})).status,200)
 assert.deepEqual((await(await fetch(base+'size-templates')).json()).templates,[template])
 const draft=form();draft.sizeKind='body_recommendation';draft.sizeFields=['height','weight'];draft.rangeFields=['height','weight'];draft.measurements={S:{height:'155-160',weight:'40-50'},M:{height:'160-165',weight:'50-60'}}
 const firstTemplate=await(await post('product-templates',{title:'长袖款',form:draft})).json()
 assert.ok(firstTemplate.id);assert.equal(firstTemplate.templates[0].form.productCode,'');assert.equal(firstTemplate.templates[0].form.confirmed,false)
 const secondTemplate=await(await post('product-templates',{title:'短袖款',form:form()})).json()
 assert.equal(secondTemplate.templates.length,2)
 draft.title='修改后的商品标题'
 assert.equal((await post('product-templates',{id:firstTemplate.id,title:'长袖款新版',form:draft})).status,200)
 const savedTemplates=(await(await fetch(base+'product-templates')).json()).templates
 assert.equal(savedTemplates.length,2);assert.equal(savedTemplates.find(t=>t.id===secondTemplate.id).form.title,form().title)
 const restoredTemplate=savedTemplates.find(t=>t.id===firstTemplate.id)
 assert.equal(restoredTemplate.form.title,draft.title);assert.deepEqual(restoredTemplate.form.measurements,draft.measurements)
 const appliedTemplate=copyAsNewProduct(restoredTemplate.form,{id:'template-product',productCode:'TPL-1'})
 assert.equal(appliedTemplate.rows[0].merchantSku,'TPL-1-WHT-S');assert.equal(appliedTemplate.reuse.checks.sizes,false)
 assert.equal((await post('product-templates',{title:'短袖款',form:draft})).status,400)
 assert.equal((await post('product-templates',{title:'',form:draft})).status,400)
 assert.equal(JSON.parse(await readFile(join(root,'product-templates.json'),'utf8')).length,2)
 const invalidDelete=await post('delete-template',{kind:'unknown',id:firstTemplate.id});assert.equal(invalidDelete.status,400)
 const deletedProduct=await(await post('delete-template',{kind:'product',id:firstTemplate.id})).json()
 assert.equal(deletedProduct.templates.length,1);assert.equal(deletedProduct.templates[0].id,secondTemplate.id)
 assert.equal(JSON.parse(await readFile(join(root,'product-templates.json.backup'),'utf8')).length,2)
 assert.equal((await post('delete-template',{kind:'product',id:firstTemplate.id})).status,400)
 const changedSize={...template,name:'更新尺寸',measurements:{S:{shoulder:'39',waist:'72'}}}
 assert.equal((await post('size-templates',{template:changedSize,action:'update'})).status,200)
 assert.equal((await(await fetch(base+'size-templates')).json()).templates[0].measurements.S.waist,'72')
 assert.equal((await post('size-templates',{template:{...changedSize,id:'missing'},action:'update'})).status,400)
 const deletedSize=await(await post('delete-template',{kind:'size',id:template.id})).json();assert.deepEqual(deletedSize.templates,[])

 const code1=await(await post('next-product-code',{})).json(),code2=await(await post('next-product-code',{})).json()
 assert.match(code1.productCode,/^A\d{8}-001$/);assert.match(code2.productCode,/^A\d{8}-002$/);assert.notEqual(code1.id,code2.id)
 const testAssets=await(await post('test-assets',{})).json();assert.equal(testAssets.main.length,1);assert.match(testAssets.main[0].preview,/^\/api\/live\/assets\//)
 const multicolor=form('白色,黑色');multicolor.main=testAssets.main;multicolor.detail=testAssets.detail;multicolor.skuImages={'白色':testAssets.sku,'黑色':testAssets.sku}
 assert.equal((await post('entry',{form:multicolor})).status,200)
 const loadedMulti=(await(await fetch(base+'entry')).json()).currentForm
 assert.equal(loadedMulti.rows.length,4);assert.equal(loadedMulti.skuImages['黑色'].path,testAssets.sku.path)
 multicolor.main=[...testAssets.main,...testAssets.main];assert.equal((await post('entry',{form:multicolor})).status,400)

 assert.equal((await post('assets',{name:'wrong.png',data:Buffer.from('not an image').toString('base64')})).status,400)
 const imageBytes=await readFile(fixture.assets[0].sourcePath)
 const uploaded=await(await post('assets',{name:'../../front.png',data:imageBytes.toString('base64')})).json()
 assert.ok(uploaded.path.startsWith(join(root,'assets')));assert.notEqual(uploaded.path,join(root,'front.png'))
 const f=form();f.main=[uploaded];assert.equal((await post('entry',{form:f})).status,200)
 const saved=JSON.parse(await readFile(join(root,'bundle.json'),'utf8'));assert.equal(saved.input.product.productCode,f.productCode);assert.equal(saved.options.mediaReceipts,undefined);assert.equal(saved.input.listing.shopKey,'pdd-123')
 const copied=copyAsNewProduct(f,{id:'copied-id',productCode:'COPY-API-1'});copied.confirmed=true
 assert.equal((await post('entry',{form:copied})).status,400)
 copied.reuse.checks={priceStock:true,images:true,sizes:true}
 assert.equal((await post('entry',{form:copied})).status,200)
 const restoredCopy=(await(await fetch(base+'entry')).json()).currentForm
 assert.equal(restoredCopy.reuse.sourceId,f.id);assert.equal(restoredCopy.confirmed,false)
 assert.equal(JSON.parse(await readFile(join(root,'bundle.json'),'utf8')).reuse.sourceId,f.id)
 assert.equal((await post('entry',{form:f})).status,200)
 f.id='new-id';assert.equal((await post('entry',{form:f})).status,400)
 f.productCode='MVP-TEST-02';f.main=[{name:'gone.png',path:join(root,'gone.png')}];assert.equal((await post('entry',{form:f})).status,400)
 const state=await(await fetch(base+'state')).json();assert.equal(state.loaded.identity.productCode,'MVP-TEST-01');assert.equal(state.pages.length,0);assert.equal(state.jobs.length,0)
 }finally{await app.close();await rm(root,{recursive:true,force:true})}
})

test('copied confirmation survives storage and is invalidated by relevant edits or cancellation',()=>{
 let copy=copyAsNewProduct(form(),{id:'copy',productCode:'COPY-1'})
 copy.confirmed=true
 assert.throws(()=>buildPackage(copy,'shop','freight'),/重新确认复用/)
 for(const key of ['priceStock','images','sizes'])copy=setReuseCheck(copy,key,true)
 copy.confirmed=true
 const restored=JSON.parse(JSON.stringify(copy))
 assert.equal(restored.reuse.sourceId,'mvp-test-id');assert.equal(reuseConfirmed(restored),true)
 assert.doesNotThrow(()=>buildPackage(restored,'shop','freight'))
 for(const key of ['priceStock','images','sizes']){
  const cancelled=setReuseCheck(restored,key,false)
  assert.equal(cancelled.confirmed,false);assert.equal(reuseConfirmed(cancelled),false)
  cancelled.confirmed=true;assert.throws(()=>buildPackage(cancelled,'shop','freight'),/重新确认复用/)
 }
 for(const [patch,key] of [[{referencePrice:'201'},'priceStock'],[{rows:restored.rows},'priceStock'],[{main:[]},'images'],[{measurements:{}},'sizes'],[{colors:'黑色'},'sizes']]){
  const edited=updateForm(restored,patch);assert.equal(edited.reuse.checks[key],false);assert.equal(edited.confirmed,false)
 }
})
test('generated codes stay unique for Chinese, punctuation, full-width and reserved-looking sizes',()=>{
 const f=form('白色,自定义色','大码,均码,M,M!,Ｍ,U5927')
 assert.equal(new Set(f.rows.map(r=>r.merchantSku)).size,f.rows.length)
 const changed=updateForm(f,{colors:'白色,黑色'})
 const rows=rebuildRows(changed)
 assert.equal(rows[0].groupPrice,f.rows[0].groupPrice)
 assert.equal(rows.find(r=>r.color==='黑色').stock,'')
 const duplicate=form();duplicate.rows[1].merchantSku=duplicate.rows[0].merchantSku
 assert.throws(()=>buildPackage(duplicate,'shop','freight'),/规格编码重复/)
})

test('extended garment columns compile and templates match size labels without inventing missing values',()=>{
 const f=form();f.sizeFields=['waist','hip','length']
 f.measurements={S:{waist:'70',hip:'90',length:'60'},M:{waist:'74',hip:'94',length:'62'}}
 const pkg=buildPackage(f,'shop','freight')
 assert.deepEqual(pkg.sizeCharts[0].columns.map(c=>c.key),['waistCircumference','hipCircumference'])
 const plan=compileProductPackage(pkg)
 assert.ok(plan.steps.some(s=>s.id==='size'))
 const restored=formFromPackage(pkg)
 assert.deepEqual(restored.sizeFields,['waist','hip']);assert.equal(restored.measurements.M.waist,'74')
 const template={id:'test',name:'样衣尺寸',fields:['waist'],measurements:{S:{waist:'72'}}}
 const applied=applySizeTemplate(f,template)
 assert.deepEqual(applied.measurements,{S:{waist:'72'},M:{}})
 assert.equal(applied.confirmed,false)
 applied.confirmed=true;assert.throws(()=>buildPackage(applied,'shop','freight'),/M/)
 f.sizeFields=['length'];assert.throws(()=>buildPackage(f,'shop','freight'),/至少选择一个/)
})

test('body recommendation ranges round trip and reject inverted or incomplete values',()=>{
 const f=form();f.sizeKind='body_recommendation';f.sizeFields=['height','weight'];f.rangeFields=['height','weight']
 f.measurements={S:{height:'155-160',weight:'40-50'},M:{height:'160-165',weight:'50-60'}}
 const pkg=buildPackage(f,'shop','freight'),plan=compileProductPackage(pkg)
 assert.equal(pkg.sizeCharts[0].kind,'body_recommendation');assert.equal(pkg.sizeCharts[0].columns[1].unit,'kg')
 assert.ok(plan.steps.some(s=>s.id==='size'))
 const restored=formFromPackage(pkg);assert.deepEqual(restored.rangeFields,['height','weight']);assert.equal(restored.measurements.S.weight,'40-50')
 const applied=applySizeTemplate(form(),{id:'body',name:'建议',kind:f.sizeKind,fields:f.sizeFields,rangeFields:f.rangeFields,measurements:f.measurements})
 assert.equal(applied.sizeKind,'body_recommendation');assert.deepEqual(applied.rangeFields,f.rangeFields)
 f.measurements.S.weight='50-40';assert.throws(()=>buildPackage(f,'shop','freight'),/下限/)
 f.measurements.S.weight='40-';assert.throws(()=>buildPackage(f,'shop','freight'),/上限未填写/)
 f.measurements.S.weight='40-50';f.sizeFields.push('waist');assert.throws(()=>buildPackage(f,'shop','freight'),/分别选择/)
})

test('incomplete product templates restore facts and allow correcting invalid matrices',()=>{
 for(const colors of ['白色,白色','',Array.from({length:41},(_,i)=>'颜色'+i).join(',')]){
  const source=form();source.colors=colors
  const applied=applyProductTemplate(source,{id:'new',productCode:'NEW-1'})
  assert.ok(applied.warning);assert.equal(applied.form.colors,colors)
  assert.equal(applied.form.rows[0].stock,source.rows[0].stock);assert.equal(applied.form.confirmed,false)
  applied.form.colors='白色';assert.doesNotThrow(()=>rebuildRows(applied.form))
 }
})
test('size kind switching retains each column selection and range mode across serialization',()=>{
 let f=form();f.sizeFields=['waist','hip'];f.rangeFields=['waist'];f.measurements.S.waist='60-70'
 f=switchSizeKind(f,'body_recommendation');f.sizeFields=['weight'];f.rangeFields=[];f.measurements.S.weight='50'
 f=switchSizeKind(JSON.parse(JSON.stringify(f)),'garment')
 assert.deepEqual(f.sizeFields,['waist','hip']);assert.deepEqual(f.rangeFields,['waist']);assert.equal(f.measurements.S.waist,'60-70')
 f=switchSizeKind(f,'body_recommendation');assert.deepEqual(f.sizeFields,['weight']);assert.deepEqual(f.rangeFields,[]);assert.equal(f.measurements.S.weight,'50')
 assert.equal(f.confirmed,false)
})

test('image and color limits reject oversized input before platform work',()=>{
 assert.throws(()=>rebuildRows(form(Array.from({length:11},(_,i)=>'色'+i).join(','),'S')),/10种颜色/)
 const f=form();f.main=Array.from({length:11},()=>f.main[0]);assert.throws(()=>buildPackage(f,'s','p'),/主图最多10张/)
 f.main=[f.main[0]];f.detail=Array.from({length:11},()=>f.detail[0]);assert.throws(()=>buildPackage(f,'s','p'),/详情图最多10张/)
})
