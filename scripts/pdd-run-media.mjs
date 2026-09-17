import { chromium } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import {executePackageMedia} from './pdd-media-task.mjs'
import {compileProductPackage} from './pdd-package-plan.mjs'
const args=process.argv.slice(2), [file,stepId,...tail]=args
const apply=tail.includes('--apply'),files=tail.filter(a=>a!=='--apply')
if(!file||!['carousel','detail','skuImages'].includes(stepId)||tail.length>2||files.length>1||files.some(a=>a.startsWith('--'))||tail.filter(a=>a==='--apply').length>1)throw new Error('用法：npm run pdd:run-media -- <商品.json> <carousel|detail|skuImages> [核验配置.json] [--apply]')
const input=JSON.parse(await readFile(resolve(file),'utf8'))
const options=files[0]?JSON.parse(await readFile(resolve(files[0]),'utf8')):{}
if(!options||Array.isArray(options)||typeof options!=='object'||Object.keys(options).some(k=>!['freightProfiles','shopBindings'].includes(k)))throw new Error('MEDIA_CONTEXT_INVALID')
const plan=compileProductPackage(input,options)
if(apply&&!plan.bindings.shopBinding)throw new Error('SHOP_BINDING_REQUIRED_FOR_WRITE')
const dir=resolve('output/playwright/real-media-task',new Date().toISOString().replaceAll(':','-'))
await mkdir(dir,{recursive:true})
const context=await chromium.launchPersistentContext(resolve(process.env.PDD_PROFILE_DIR || '.runtime/pdd-inspection-profile'),{channel:'chrome',headless:false,viewport:null})
const terminal=createInterface({input:process.stdin,output:process.stdout})
try {
  const page=context.pages()[0] || await context.newPage()
  await page.goto('https://mms.pinduoduo.com/goods/category')
  console.log(JSON.stringify({mode:apply?'上传并记录':'只读预检',identity:plan.identity,stepId},null,2))
  await terminal.question('请在独立窗口登录并进入指定店铺的新建 T 恤编辑页，并填写与计划相符的货号，请确认目标图片区状态符合上传条件。准备好后按 Enter：')
  const targets=context.pages().filter(p=>new URL(p.url()).pathname==='/goods/goods_add/index')
  if (targets.length!==1) throw new Error('需要且只能有一个商品编辑页')
  const result=await executePackageMedia(targets[0],input,{...options,stepId,dryRun:!apply})
  await writeFile(`${dir}/report.json`,JSON.stringify(result,null,2))
  console.log(`结果：${result.status}；报告：${dir}/report.json。未保存或发布。`)
  await terminal.question('可在浏览器检查结果；按 Enter 关闭本次测试窗口：')
} catch(error) {
  await writeFile(`${dir}/report.json`,JSON.stringify(error.partialResult || {status:'failed',reason:error.message,saved:false,published:false},null,2))
  process.exitCode=2
  console.error(error.message)
  await terminal.question('测试已停止，请检查页面是否部分填写；按 Enter 关闭：')
} finally {terminal.close();await context.close()}
