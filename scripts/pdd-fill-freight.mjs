import { chromium } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { executeFreight, compileFreightPlan } from './pdd-freight.mjs'
const args=process.argv.slice(2), file=args.find(arg=>!arg.startsWith('--'))
if (!file || args.some(arg=>arg.startsWith('--') && arg!=='--apply')) throw new Error('用法：npm run pdd:fill-freight -- <计划.json>  [--apply]；默认只读预检')
const input=JSON.parse(await readFile(resolve(file),'utf8'))
const plan=compileFreightPlan(input)
const dir=resolve('output/playwright/real-freight',new Date().toISOString().replaceAll(':','-'))
await mkdir(dir,{recursive:true})
const context=await chromium.launchPersistentContext(resolve(process.env.PDD_PROFILE_DIR || '.runtime/pdd-inspection-profile'),{channel:'chrome',headless:false,viewport:null})
const terminal=createInterface({input:process.stdin,output:process.stdout})
try {
  const page=context.pages()[0] || await context.newPage()
  await page.goto('https://mms.pinduoduo.com/goods/category')
  console.log(JSON.stringify({mode:args.includes('--apply')?'填写运费模板并回读':'只读预检',plan},null,2))
  await terminal.question('请在独立窗口登录并进入指定店铺的新建 T 恤编辑页，并填写与计划相符的货号，仅填写明确指定的模板名称和配送规则。准备好后按 Enter：')
  const targets=context.pages().filter(p=>new URL(p.url()).pathname==='/goods/goods_add/index')
  if (targets.length!==1) throw new Error('需要且只能有一个商品编辑页')
  const result=await executeFreight(targets[0],input,{dryRun:!args.includes('--apply')})
  await writeFile(`${dir}/report.json`,JSON.stringify(result,null,2))
  console.log(`结果：${result.status}；报告：${dir}/report.json。未保存或发布。`)
  await terminal.question('可在浏览器检查结果；按 Enter 关闭本次测试窗口：')
} catch(error) {
  await writeFile(`${dir}/report.json`,JSON.stringify(error.partialResult || {status:'failed',reason:error.message,saved:false,published:false},null,2))
  process.exitCode=2
  console.error(error.message)
  await terminal.question('测试已停止，请检查页面是否部分填写；按 Enter 关闭：')
} finally {terminal.close();await context.close()}
