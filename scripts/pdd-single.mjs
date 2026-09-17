import {chromium} from '@playwright/test'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createInterface} from 'node:readline/promises'
import {compileProductPackage} from './pdd-package-plan.mjs'
import {runSingleWorkflow} from './pdd-single-workflow.mjs'
if(process.argv.includes('--help')){
 console.log('用法：npm run pdd:single -- 商品.json 核验配置.json\n打开独立Chrome窗口，登录并进入T恤编辑页后，从菜单选择填写、核对或保存草稿重开。\n不会自动发布；重复/失败任务需要核对，不自动重试。默认资料目录：.runtime/pdd-single-profile。');process.exit(0)
}
const [inputPath,configPath,...extra]=process.argv.slice(2)
if(!inputPath||!configPath||extra.length)throw new Error('用法：npm run pdd:single -- 商品.json 核验配置.json')
const input=JSON.parse(await readFile(resolve(inputPath),'utf8')),options=JSON.parse(await readFile(resolve(configPath),'utf8'))
if(!options||Array.isArray(options)||Object.keys(options).some(k=>!['shopBindings','freightProfiles','mediaReceipts'].includes(k)))throw new Error('SINGLE_CONTEXT_INVALID')
const plan=compileProductPackage(input,options)
if(!plan.bindings.shopBinding)throw new Error('请在配置中提供shopBindings店铺绑定')
const terminal=createInterface({input:process.stdin,output:process.stdout})
let browser
try{
 browser=await chromium.launchPersistentContext(resolve(process.env.PDD_PROFILE_DIR||'.runtime/pdd-single-profile'),{channel:'chrome',headless:false,viewport:null})
 const start=browser.pages()[0]??await browser.newPage();await start.goto('https://mms.pinduoduo.com/goods/category')
 console.log(`商品：${plan.identity.productCode}；店铺：${plan.bindings.shopBinding.shopName}\n请登录并选择 女装/女士精品 > T恤 > T恤，进入编辑页。新商品货号可留空。`)
 for(;;){
  const choice=(await terminal.question('\n1 填写并核对；2 只核对；3 保存草稿并重开；4 从草稿箱重开核对；5 读取发布结果；0 退出：')).trim()
  if(choice==='0')break
  const action={1:'fill',2:'inspect',3:'save-draft',4:'reopen-draft',5:'publication-result'}[choice];if(!action){console.log('请输入0～5');continue}
  const pages=browser.pages().filter(p=>{try{return new URL(p.url()).pathname==='/goods/goods_add/index'}catch{return false}})
  if(!pages.length){console.log('尚未找到商品编辑页，请先在浏览器进入。');continue}
  let page=pages[0]
  if(pages.length>1){pages.forEach((p,i)=>console.log(`${i+1}: ${p.url()}`));const n=Number(await terminal.question('选择要操作的编辑页编号：'));if(!Number.isInteger(n)||n<1||n>pages.length){console.log('编号无效');continue}page=pages[n-1]}
  try{
   if(action==='save-draft')console.log('将保存未发布草稿，并在新标签页核对；素材/资质尚有待确认项，不会发布。')
   const result=await runSingleWorkflow(page,input,options,{action,onProgress:p=>console.log(`正在处理：${p.step}${p.total?` (${p.index}/${p.total})`:''}`)})
   const dir=resolve('output/single-reports',new Date().toISOString().replaceAll(':','-'));await mkdir(dir,{recursive:true});await writeFile(dir+'/report.json',JSON.stringify(result,null,2))
   if(result.directory&&action==='fill')Object.assign(options,JSON.parse(await readFile(result.directory+'/readback-context.json','utf8')))
   console.log(`结果：${result.status}\n报告：${dir}/report.json\n字段核对：${JSON.stringify(result.report?.counts)}\n保存：${result.saved}；在售确认：${result.published}；链接：${result.productUrl??'暂无'}`)
  }catch(e){console.error(`已停止：${e.message}。可能已部分填写，请选2核对；不要直接重复执行。`)}
 }
}finally{terminal.close();if(browser)await browser.close()}
