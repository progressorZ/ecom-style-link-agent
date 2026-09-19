import {templateForm} from '../src/product-templates.ts'
import {validateSizeTemplate} from '../src/size-fields.ts'
import {editorIdentity} from './pdd-draft-list.mjs'
import {recoveryReference,reconcileDraft} from './pdd-reconcile.mjs'
import {createReview} from './pdd-review.mjs'
import {createServer} from 'node:http'
import {randomUUID} from 'node:crypto'
import {mkdir,readFile,writeFile,rename,readdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {chromium} from 'playwright'
import {compileProductPackage} from './pdd-package-plan.mjs'
import {runSingleWorkflow} from './pdd-single-workflow.mjs'
import {buildPackage,collectFormIssues,attributeLabels,formFromPackage} from '../src/mvp-form.ts'
import {loadImageFiles} from './pdd-image-plan.mjs'
import {resolveFreightProfile} from './pdd-freight-profile.mjs'
import {resolveShopBinding} from './pdd-shop-identity.mjs'

const dataRoot=()=>resolve(process.env.ECOM_DATA_DIR||'.')
export async function launchMerchantBrowser(){
 const profile=resolve(dataRoot(),'.runtime/pdd-workbench-profile')
 const requested=process.env.PDD_BROWSER_CHANNEL
 const channels=requested?[requested]:process.platform==='win32'?['chrome','msedge']:['chrome']
 const failures=[]
 for(const channel of channels){
  try{return await chromium.launchPersistentContext(profile,{channel,headless:false,viewport:null,args:['--remote-debugging-port=0','--remote-debugging-address=127.0.0.1']})}
  catch(error){failures.push(`${channel}: ${String(error.message).split('\n')[0]}`)}
 }
 throw new Error('未找到可用的商家浏览器。Windows 请安装或启用 Microsoft Edge/Google Chrome。'+failures.join('；'))
}
export function createLiveServer({root=resolve(dataRoot(),'output/live-workbench'),launch=launchMerchantBrowser,run=runSingleWorkflow,reconcile=reconcileDraft}={}){
 let bundle=null,browser=null,busy=false,activeTask=Promise.resolve(),preferences=null
 const jobs=new Map(),pages=new Map(),pageIds=new WeakMap()
 const staticPort=Number(process.env.ECOM_STATIC_PORT||5173)
 const allowedOrigins=new Set([`http://127.0.0.1:${staticPort}`,`http://localhost:${staticPort}`,'http://127.0.0.1:5173','http://localhost:5173','http://127.0.0.1:4173','http://localhost:4173','http://127.0.0.1:4318'])
 let writes=Promise.resolve()
 const persist=job=>{const snapshot=JSON.stringify(job,null,2);writes=writes.then(async()=>{await mkdir(root,{recursive:true});const temp=join(root,job.id+'.tmp');await writeFile(temp,snapshot,{mode:0o600});await rename(temp,join(root,job.id+'.json'))});return writes}
 const persistBundle=async()=>{await mkdir(root,{recursive:true});const temp=join(root,'bundle.tmp');await writeFile(temp,JSON.stringify({input:bundle.input,options:bundle.options,reuse:bundle.reuse,entryForm:bundle.entryForm}),{mode:0o600});await rename(temp,join(root,'bundle.json'))}
 const refreshPages=()=>{pages.clear();if(browser)for(const page of browser.pages()){if(page.isClosed())continue;let id=pageIds.get(page);if(!id){id=randomUUID();pageIds.set(page,id)}pages.set(id,page)}return [...pages].map(([id,page])=>({id,url:page.url()}))}
 const state=()=>({mode:'real',busy,loaded:bundle?{identity:bundle.plan.identity,shop:bundle.plan.bindings.shopBinding,title:bundle.input.listing.title,steps:bundle.plan.steps.map(s=>s.id),blockers:bundle.plan.blockers}:null,pages:refreshPages(),jobs:[...jobs.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))})
 const loadHistory=async()=>{await mkdir(root,{recursive:true});for(const f of await readdir(root)){if(!/^[\da-f-]+\.json$/.test(f))continue;try{const j=JSON.parse(await readFile(join(root,f),'utf8'));if(j.status==='running'){j.status='needs_inspection';j.error='上次服务已结束，任务结果需人工核对；不会自动重跑'}jobs.set(j.id,j)}catch{}}}
 const ready=(async()=>{await loadHistory();try{preferences=JSON.parse(await readFile(join(root,'settings.json'),'utf8'))}catch{}try{const saved=JSON.parse(await readFile(join(root,'bundle.json'),'utf8'));const plan=compileProductPackage(saved.input,saved.options);if(plan.bindings.shopBinding)bundle={...saved,plan}}catch{}})()
 const entryContext=()=>preferences??(bundle?{shopKey:bundle.input.listing.shopKey,profileKey:bundle.input.listing.logistics.profileKey,options:bundle.options}:null)
 const server=createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))}
  try{
   await ready
   if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host??''))return send(403,{error:'只允许本机访问'})
   if(req.headers.origin&&!allowedOrigins.has(req.headers.origin))return send(403,{error:'请求来源不允许'})
   const path=new URL(req.url,'http://127.0.0.1').pathname
   if(req.method==='GET'&&path==='/api/live/state')return send(200,state())
   const preview=/^\/api\/live\/assets\/([a-f0-9-]+\.(png|jpg))$/.exec(path)
   if(req.method==='GET'&&preview){try{const bytes=await readFile(join(root,'assets',preview[1]));res.writeHead(200,{'content-type':preview[2]==='png'?'image/png':'image/jpeg','cache-control':'private, max-age=3600','x-content-type-options':'nosniff'});return res.end(bytes)}catch{return send(404,{error:'本机图片已不存在，请重新选择'})}}
   if(req.method==='GET'&&path==='/api/live/product-templates'){
    let templates=[];try{templates=JSON.parse(await readFile(join(root,'product-templates.json'),'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
    return send(200,{templates})
   }
   if(req.method==='GET'&&path==='/api/live/size-templates'){
    let templates=[];try{templates=JSON.parse(await readFile(join(root,'size-templates.json'),'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
    return send(200,{templates})
   }
   if(req.method==='GET'&&path==='/api/live/entry'){
    const context=entryContext(),binding=context?resolveShopBinding(context.shopKey,context.options.shopBindings):null,freight=context?resolveFreightProfile({platform:'pdd',shopKey:context.shopKey,logistics:{profileKey:context.profileKey}},context.options.freightProfiles??[]):null
    const attrs=bundle?.input.product.attributes??{}
    const currentForm=bundle?{...structuredClone(bundle.entryForm??formFromPackage(bundle.input)),confirmed:false}:null
    if(currentForm){if(bundle.reuse)currentForm.reuse=structuredClone(bundle.reuse);const prefix=resolve(root,'assets')+'/';const preview=picture=>picture.path.startsWith(prefix)?{...picture,preview:'/api/live/assets/'+picture.path.split('/').at(-1)}:picture;currentForm.main=currentForm.main.map(preview);currentForm.detail=currentForm.detail.map(preview);currentForm.skuImages=Object.fromEntries(Object.entries(currentForm.skuImages).map(([color,picture])=>[color,preview(picture)]))}
    return send(200,{currentForm,settings:binding&&freight?{shopName:binding.shopName,mallId:binding.mallId,templateName:freight.freight.templateName,groups:freight.freight.expectedGroups}:null,defaults:bundle?{brand:bundle.input.product.brand??'',attributes:Object.fromEntries(Object.keys(attributeLabels).map(k=>[k,Array.isArray(attrs[k])?attrs[k].join(','):String(attrs[k]??'')]))}:null})
   }
   if(req.method!=='POST'||!allowedOrigins.has(req.headers.origin)||!req.headers['content-type']?.startsWith('application/json'))return send(403,{error:'需要来自本地工作台的JSON请求'})
   if(busy)return send(409,{error:'已有任务执行中，请等待结果'})
   const maxBody=path==='/api/live/assets'?15*1024*1024:4*1024*1024
   let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>maxBody)return send(413,{error:'文件或数据过大，请压缩后重试'});body+=chunk}
   const data=JSON.parse(body||'{}')
   // Recheck after awaiting request body so simultaneous requests cannot start two jobs.
   if(busy)return send(409,{error:'已有任务执行中'})
   if(path==='/api/live/delete-template'){
    busy=true
    try{
     if(!['product','size'].includes(data.kind)||typeof data.id!=='string')throw new Error('模板类型或编号无效')
     const file=join(root,data.kind+'-templates.json')
     const templates=JSON.parse(await readFile(file,'utf8'))
     if(!templates.some(t=>t.id===data.id))throw new Error('模板不存在，请刷新列表')
     // Keep a local recovery snapshot; never remove referenced images or current product.
     await writeFile(file+'.backup',JSON.stringify(templates),{mode:0o600})
     const next=templates.filter(t=>t.id!==data.id)
     await writeFile(file+'.tmp',JSON.stringify(next),{mode:0o600});await rename(file+'.tmp',file)
     return send(200,{templates:next})
    }finally{busy=false}
   }
   if(path==='/api/live/product-templates'){
    busy=true
    try{
     const title=typeof data.title==='string'?data.title.trim():''
     if(!title||title.length>80)throw new Error('模板标题必填，最多80个字')
     let templates=[];try{templates=JSON.parse(await readFile(join(root,'product-templates.json'),'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
     if(data.id&&!templates.some(t=>t.id===data.id))throw new Error('待更新模板不存在，请刷新模板列表')
     if(templates.some(t=>t.title===title&&t.id!==data.id))throw new Error('已有同名模板，请换一个标题或选择更新该模板')
     const id=data.id||randomUUID(),form=templateForm(data.form)
     form.id=id
     const template={id,title,updatedAt:new Date().toISOString(),form}
     templates=templates.filter(t=>t.id!==id);templates.push(template)
     await mkdir(root,{recursive:true});await writeFile(join(root,'product-templates.tmp'),JSON.stringify(templates),{mode:0o600});await rename(join(root,'product-templates.tmp'),join(root,'product-templates.json'))
     return send(200,{templates,id})
    }finally{busy=false}
   }
   if(path==='/api/live/size-templates'){
    busy=true
    try{
     const template=validateSizeTemplate(data.template)
     let templates=[];try{templates=JSON.parse(await readFile(join(root,'size-templates.json'),'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
     template.name=template.name.trim()
     if(data.action==='update'&&!templates.some(t=>t.id===template.id))throw new Error('尺码模板不存在，请刷新列表')
     if(templates.some(t=>t.name===template.name&&t.id!==template.id))throw new Error('已有同名尺码模板，请换一个名称或更新所选模板')
     templates=templates.filter(t=>t.id!==template.id);templates.push(template)
     await mkdir(root,{recursive:true});await writeFile(join(root,'size-templates.tmp'),JSON.stringify(templates),{mode:0o600});await rename(join(root,'size-templates.tmp'),join(root,'size-templates.json'))
     return send(200,{templates})
    }finally{busy=false}
   }
   if(path==='/api/live/next-product-code'){
    busy=true
    try{
     const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replaceAll('-','')
     let sequence={day,count:0};try{const saved=JSON.parse(await readFile(join(root,'product-code-sequence.json'),'utf8'));if(saved.day===day&&Number.isSafeInteger(saved.count))sequence=saved}catch{}
     sequence.count++;await mkdir(root,{recursive:true});await writeFile(join(root,'product-code-sequence.tmp'),JSON.stringify(sequence),{mode:0o600});await rename(join(root,'product-code-sequence.tmp'),join(root,'product-code-sequence.json'))
     return send(200,{id:randomUUID(),productCode:`A${day}-${String(sequence.count).padStart(3,'0')}`})
    }finally{busy=false}
   }
   if(path==='/api/live/test-assets'){
    busy=true
    try{
     const folder=join(root,'assets');await mkdir(folder,{recursive:true})
     const store=async(source,name)=>{const bytes=await readFile(source instanceof URL?source:resolve(source));const destination=resolve(folder,randomUUID()+'.png');await writeFile(destination,bytes,{flag:'wx',mode:0o600});return {name,path:destination,preview:'/api/live/assets/'+destination.split('/').at(-1)}}
     const front=await store(new URL('../examples/test-images/front.png',import.meta.url),'自动化测试正面图.png'),back=await store(new URL('../examples/test-images/back.png',import.meta.url),'自动化测试背面图.png')
     return send(200,{main:[front],detail:[back],sku:front,warning:'仅用于测试草稿，图片已标注勿上架'})
    }finally{busy=false}
   }
   if(path==='/api/live/settings'){
    busy=true
    try{
     if(data.confirmed!==true)throw new Error('请核对店铺编号、运费模板及地区规则并确认')
     const mallId=String(data.mallId??'').trim(),shopName=String(data.shopName??'').trim(),shopKey=`pdd-${mallId}`,profileKey='mvp-logistics'
     const options={shopBindings:[{platform:'pdd',shopKey,shopName,mallId}],freightProfiles:[{version:'pdd-freight-profile-v1',platform:'pdd',shopKey,profileKey,revision:1,confirmation:{confirmed:true,confirmedAt:new Date().toISOString(),reference:'用户在店铺设置表单确认'},freight:{mode:'other',templateName:String(data.templateName??'').trim(),expectedGroups:String(data.groups??'').split('\n').map(s=>s.trim()).filter(Boolean)}}]}
     resolveShopBinding(shopKey,options.shopBindings);resolveFreightProfile({platform:'pdd',shopKey,logistics:{profileKey}},options.freightProfiles)
     const next={shopKey,profileKey,options};await mkdir(root,{recursive:true});await writeFile(join(root,'settings.tmp'),JSON.stringify(next),{mode:0o600});await rename(join(root,'settings.tmp'),join(root,'settings.json'));preferences=next
     return send(200,{saved:true})
    }finally{busy=false}
   }
   if(path==='/api/live/assets'){
    if(typeof data.name!=='string'||typeof data.data!=='string'||!data.data.length||data.data.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.data))throw new Error('请选择有效的 JPG 或 PNG 图片')
    const bytes=Buffer.from(data.data,'base64')
    const ext=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'jpg':null
    if(!ext||bytes.length>3_000_000)throw new Error('当前模板仅支持不超过 3MB 的 JPG / PNG 图片')
    const folder=join(root,'assets');await mkdir(folder,{recursive:true});const destination=resolve(folder,randomUUID()+'.'+ext)
    await writeFile(destination,bytes,{flag:'wx',mode:0o600});return send(200,{name:data.name.slice(0,200),path:destination,preview:'/api/live/assets/'+destination.split('/').at(-1)})
   }
   if(path==='/api/live/entry'){
    busy=true
    try{
     const context=entryContext();if(!context)throw new Error('请先配置店铺与运费模板')
     const issues=collectFormIssues(data.form,true);if(issues.length)return send(400,{error:issues.map(i=>i.message).join('\n'),issues})
     const input=buildPackage(data.form,context.shopKey,context.profileKey)
     if(bundle?.input.product.id===input.product.id){input.product.revision=bundle.input.product.revision+1;input.listing.revision=bundle.input.listing.revision+1}
     if(bundle&&input.product.id!==bundle.input.product.id&&input.product.productCode===bundle.input.product.productCode)throw new Error('新商品货号与上一款相同，请为新款填写不同货号')
     // New or edited packages must never inherit remote media receipts from another version.
     const options={shopBindings:context.options.shopBindings,freightProfiles:context.options.freightProfiles}
     const plan=compileProductPackage(input,options)
     if(!plan.bindings.shopBinding||!plan.bindings.freightProfile)throw new Error('店铺或运费配置不完整，请重新保存店铺设置')
     for(const role of ['main','detail','sku'])await loadImageFiles({scope:'pdd-tshirt-carousel-v1',productCode:input.product.productCode,images:input.assets.filter(a=>a.role===role).map(a=>({id:a.id,path:a.sourcePath}))},{allowShared:role==='sku'})
     const next={input:structuredClone(input),options:structuredClone(options),plan,reuse:structuredClone(data.form.reuse),entryForm:structuredClone(data.form)}
     const old=bundle;bundle=next;try{await persistBundle()}catch(e){bundle=old;throw e}
     return send(200,state())
    }finally{busy=false}
   }
   if(path==='/api/live/package'){
    busy=true
    try{
    const {input,options}=data
    if(!options||Array.isArray(options)||Object.keys(options).some(k=>!['shopBindings','freightProfiles','mediaReceipts'].includes(k)))throw new Error('核验配置字段不正确')
    const plan=compileProductPackage(input,options);if(!plan.bindings.shopBinding)throw new Error('缺少店铺绑定shopBindings')
    bundle={input:structuredClone(input),options:structuredClone(options),plan};await persistBundle();return send(200,state())
    }finally{busy=false}
   }
   if(path==='/api/live/reviews'){
    busy=true
    try{
    const job=jobs.get(data.jobId)
    const review=createReview(job,data,bundle?.plan,[...jobs.values()])
    job.reviews=[...(job.reviews??[]),review];await persist(job);return send(200,{review})
    }finally{busy=false}
   }
   if(path==='/api/live/browser'){
    if(data.editorUrl!==undefined)editorIdentity(data.editorUrl)
    busy=true
    try{if(!browser){browser=await launch();browser.on('close',()=>{browser=null});const page=browser.pages()[0]??await browser.newPage();await page.goto(data.editorUrl??'https://mms.pinduoduo.com/goods/category')}const active=browser.pages().filter(p=>!p.isClosed()).at(-1);if(active?.bringToFront)await active.bringToFront();return send(200,state())}finally{busy=false}
   }
   if(path==='/api/live/jobs'){
    if(!['inspect','reopen-draft','recover-draft','publication-result','fill','repair','save-draft'].includes(data.action))throw new Error('不支持该动作；工作台没有自动发布功能')
    if(!bundle||!browser)throw new Error('请先导入商品并打开商家浏览器')
    refreshPages();const page=pages.get(data.pageId)
    let reference,editorUrl
    if(data.action==='recover-draft'){
     reference=recoveryReference(jobs.get(data.sourceJobId),bundle.plan);editorUrl=reference.editorUrl
    }else{
     if(!page||page.isClosed())throw new Error('所选页面已关闭，请刷新页面列表')
     editorUrl=page.url();const u=new URL(editorUrl);if(u.origin!=='https://mms.pinduoduo.com'||u.pathname!=='/goods/goods_add/index')throw new Error('请在商家浏览器进入T恤商品编辑页')
    }
    busy=true
    const snapshot=structuredClone({input:bundle.input,options:bundle.options})
    const job={id:randomUUID(),action:data.action,status:'running',createdAt:new Date().toISOString(),productCode:bundle.plan.identity.productCode,editorUrl,sourceHash:bundle.plan.sourceHash,executionHash:bundle.plan.executionHash,sourceJobId:reference?.sourceJobId??null,events:[],published:false}
    jobs.set(job.id,job)
    try{await persist(job)}catch(e){busy=false;throw e}
    send(202,{job})
    activeTask=(async()=>{
     try{
      const onProgress=event=>{job.events.push({...event,at:new Date().toISOString()});persist(job).catch(()=>{})}
      job.result=data.action==='recover-draft'?await reconcile(browser,snapshot.input,snapshot.options,{reference,onProgress}):await run(page,snapshot.input,snapshot.options,{action:data.action,journalRoot:join(root,'tasks'),onProgress})
      if(data.action==='fill'&&job.result.directory){bundle.options=JSON.parse(await readFile(join(job.result.directory,'readback-context.json'),'utf8'));await persistBundle()}
      job.status='completed';if(job.result.report?.checks?.some(c=>['mismatch','unreadable'].includes(c.status))){job.status='needs_inspection';job.error='独立核对发现字段差异，未通过验收；请查看报告'}
     }catch(e){job.status='needs_inspection';job.error=e.message;job.partialResult=e.partialResult??null}
     finally{job.finishedAt=new Date().toISOString();try{await persist(job)}finally{busy=false}}
    })().catch(e=>{job.status='needs_inspection';job.error='任务记录写入失败：'+e.message;busy=false})
    return
   }
   send(404,{error:'未找到操作'})
  }catch(e){send(400,{error:e.message})}
 })
 return {server,ready,close:async()=>{busy=true;if(browser)await browser.close();await activeTask.catch(()=>{});await writes.catch(()=>{});await new Promise(r=>server.close(r))}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const app=createLiveServer(),port=Number(process.env.ECOM_API_PORT||4318);let stopping=false;const stop=()=>{if(stopping)return;stopping=true;app.close().then(()=>process.exit(0),()=>process.exit(1))};process.on('SIGINT',stop);process.on('SIGTERM',stop);app.server.listen(port,'127.0.0.1',()=>console.log(`真实工作台服务：http://127.0.0.1:${port}。使用工作台网页访问。`))}
