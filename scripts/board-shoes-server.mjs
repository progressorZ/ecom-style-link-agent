import {createServer} from 'node:http'
import {randomUUID} from 'node:crypto'
import {access,mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {chromium} from 'playwright'
import {createWorkbenchBackup,restoreWorkbenchBackup} from './workbench-backup.mjs'
import {discoverPddSelectOptions} from './pdd-option-discovery.mjs'

const dataRoot=()=>resolve(process.env.ECOM_DATA_DIR||'.')
export async function launchBoardShoesBrowser(){
 const profile=resolve(dataRoot(),'.runtime/pdd-board-shoes-profile'),requested=process.env.PDD_BROWSER_CHANNEL
 const channels=requested?[requested]:process.platform==='win32'?['chrome','msedge']:['chrome'],failures=[]
 for(const channel of channels){try{return await chromium.launchPersistentContext(profile,{channel,headless:false,viewport:null,args:['--remote-debugging-port=0','--remote-debugging-address=127.0.0.1']})}catch(error){failures.push(`${channel}: ${String(error.message).split('\n')[0]}`)}}
 throw new Error('未找到可用的商家浏览器。Windows 请安装或启用 Microsoft Edge/Google Chrome。'+failures.join('；'))
}

export function createBoardShoesServer({root=resolve(dataRoot(),'output/board-shoes-workbench'),launch=launchBoardShoesBrowser}={}){
 let browser=null,busy=false,restartRequired=false
 const staticPort=Number(process.env.ECOM_STATIC_PORT||5173),allowedOrigins=new Set([`http://127.0.0.1:${staticPort}`,`http://localhost:${staticPort}`,'http://127.0.0.1:5173','http://localhost:5173','http://127.0.0.1:4173','http://localhost:4173'])
 const state=()=>({appId:'pdd-board-shoes',mode:'board-shoes-draft',busy,restartRequired,pages:browser?browser.pages().filter(page=>!page.isClosed()).map(page=>({url:page.url()})):[]})
 const reportPath=join(root,'discovery','board-shoes-options-latest.json')
 const readReport=async()=>{try{return JSON.parse(await readFile(reportPath,'utf8'))}catch{return null}}
 const sendJson=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))}
 const server=createServer(async(req,res)=>{
  const send=(status,data)=>sendJson(res,status,data)
  try{
   if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host??''))return send(403,{error:'只允许本机访问'})
   if(req.headers.origin&&!allowedOrigins.has(req.headers.origin))return send(403,{error:'请求来源不允许'})
   const path=new URL(req.url,'http://127.0.0.1').pathname
   if(req.method==='GET'&&path==='/api/live/state')return send(200,state())
   if(req.method==='GET'&&path==='/api/live/backup')return send(200,await createWorkbenchBackup(root))
   const preview=/^\/api\/live\/assets\/([a-f0-9-]+\.(png|jpg))$/.exec(path)
   if(req.method==='GET'&&preview){try{const bytes=await readFile(join(root,'assets',preview[1]));res.writeHead(200,{'content-type':preview[2]==='png'?'image/png':'image/jpeg','cache-control':'private, max-age=3600','x-content-type-options':'nosniff'});return res.end(bytes)}catch{return send(404,{error:'本机图片已不存在，请重新选择'})}}
   if(req.method!=='POST'||!allowedOrigins.has(req.headers.origin)||!req.headers['content-type']?.startsWith('application/json'))return send(403,{error:'需要来自本地工作台的 JSON 请求'})
   if(busy)return send(409,{error:'已有任务执行中，请等待结果'})
   const maxBody=path==='/api/live/restore'?165*1024*1024:path==='/api/live/assets'?15*1024*1024:4*1024*1024
   let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>maxBody)return send(413,{error:'文件或数据过大，请压缩后重试'});body+=chunk}
   const data=JSON.parse(body||'{}')
   if(path==='/api/live/restore'){
    busy=true;try{if(data.confirmed!==true)throw new Error('恢复资料前需要明确确认');const result=await restoreWorkbenchBackup(root,data.backup);restartRequired=true;return send(200,result)}finally{busy=false}
   }
   if(restartRequired)return send(409,{error:'资料已经恢复，请关闭启动窗口并重新启动助手'})
   if(path==='/api/live/next-product-code'){
    busy=true;try{const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replaceAll('-','');let sequence={day,count:0};try{const saved=JSON.parse(await readFile(join(root,'product-code-sequence.json'),'utf8'));if(saved.day===day&&Number.isSafeInteger(saved.count))sequence=saved}catch{}sequence.count++;await mkdir(root,{recursive:true});await writeFile(join(root,'product-code-sequence.tmp'),JSON.stringify(sequence),{mode:0o600});await rename(join(root,'product-code-sequence.tmp'),join(root,'product-code-sequence.json'));return send(200,{id:randomUUID(),productCode:`A${day}-${String(sequence.count).padStart(3,'0')}`})}finally{busy=false}
   }
   if(path==='/api/live/test-assets'){
    busy=true;try{const folder=join(root,'assets');await mkdir(folder,{recursive:true});const store=async(source,name)=>{const bytes=await readFile(source),assetId=randomUUID()+'.png',destination=resolve(folder,assetId);await writeFile(destination,bytes,{flag:'wx',mode:0o600});return {name,path:destination,assetId,preview:'/api/live/assets/'+assetId}};const front=await store(new URL('../examples/test-images/front.png',import.meta.url),'自动化测试正面图.png'),back=await store(new URL('../examples/test-images/back.png',import.meta.url),'自动化测试背面图.png');return send(200,{main:[front],detail:[back],sku:front,warning:'仅用于测试草稿，图片已标注勿上架'})}finally{busy=false}
   }
   if(path==='/api/live/assets'){
    if(typeof data.name!=='string'||typeof data.data!=='string'||!data.data.length||data.data.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.data))throw new Error('请选择有效的 JPG 或 PNG 图片')
    const bytes=Buffer.from(data.data,'base64'),ext=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'jpg':null
    if(!ext||bytes.length>3_000_000)throw new Error('当前模板仅支持不超过 3MB 的 JPG / PNG 图片')
    const folder=join(root,'assets'),assetId=randomUUID()+'.'+ext,destination=resolve(folder,assetId);await mkdir(folder,{recursive:true});await writeFile(destination,bytes,{flag:'wx',mode:0o600});return send(200,{name:data.name.slice(0,200),path:destination,assetId,preview:'/api/live/assets/'+assetId})
   }
   if(path==='/api/live/assets-status'){
    if(!Array.isArray(data.assetIds)||data.assetIds.length>500||data.assetIds.some(id=>typeof id!=='string'||!/^[a-f0-9-]+\.(?:png|jpg)$/i.test(id)))throw new Error('素材编号列表无效')
    const available=[];for(const id of [...new Set(data.assetIds)])try{await access(join(root,'assets',id));available.push(id)}catch{}
    return send(200,{available,missing:data.assetIds.filter(id=>!available.includes(id))})
   }
   if(path==='/api/live/browser'){
    busy=true;try{if(!browser){browser=await launch();browser.on('close',()=>{browser=null})}let active=browser.pages().filter(page=>!page.isClosed()).at(-1);if(!active){active=await browser.newPage();await active.goto('https://mms.pinduoduo.com/goods/category')}await active.bringToFront();return send(200,state())}finally{busy=false}
   }
   if(path==='/api/live/board-shoes-options'){
    if(data.action==='clear'){await rm(reportPath,{force:true});return send(200,{report:null})}
    if(data.action!=='get')throw new Error('不支持的采集结果操作')
    return send(200,{report:await readReport()})
   }
   if(path==='/api/live/discover-board-shoes'){
    if(!browser)throw new Error('请先打开专用商家浏览器，并进入童鞋板鞋发布页')
    busy=true
    try{
     const candidates=browser.pages().filter(page=>{try{const url=new URL(page.url());return url.origin==='https://mms.pinduoduo.com'&&url.pathname==='/goods/goods_add/index'&&url.searchParams.get('id')==='201517965903'}catch{return false}})
     if(candidates.length!==1)throw new Error(candidates.length?'检测到多个童鞋板鞋编辑页，请只保留一个':'没有找到童鞋板鞋编辑页；请在专用商家浏览器进入类目 ID 201517965903 的发布页')
     const raw=await discoverPddSelectOptions(candidates[0]),report={...raw,profileId:'pdd-board-shoes',categoryId:'201517965903',contractVersion:'board-shoes-v1'}
     const folder=join(root,'discovery');await mkdir(folder,{recursive:true});const filename=`board-shoes-options-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}.json`
     await writeFile(join(folder,filename),JSON.stringify(report,null,2),{mode:0o600});await writeFile(reportPath+'.tmp',JSON.stringify(report,null,2),{mode:0o600});await rename(reportPath+'.tmp',reportPath)
     return send(200,{report,filename,collected:report.results.filter(item=>item.status==='collected').length,disabled:report.results.filter(item=>item.status==='disabled').length,unreadable:report.results.filter(item=>item.status==='unreadable').length})
    }finally{busy=false}
   }
   send(404,{error:'未找到操作'})
  }catch(error){send(400,{error:error instanceof Error?error.message:'本机操作失败'})}
 })
 return {server,close:async()=>{if(browser)await browser.close();await new Promise(resolveClose=>server.close(resolveClose))}}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const app=createBoardShoesServer(),port=Number(process.env.ECOM_API_PORT||4318);let stopping=false;const stop=()=>{if(stopping)return;stopping=true;app.close().then(()=>process.exit(0),()=>process.exit(1))};process.on('SIGINT',stop);process.on('SIGTERM',stop);app.server.listen(port,'127.0.0.1',()=>console.log(`板鞋资料工作台服务：http://127.0.0.1:${port}`))}
