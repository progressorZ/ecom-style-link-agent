// Controlled fixture entry through visible workbench controls. Never publishes.
import {readFile} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import {attributeLabels} from '../src/mvp-form.ts'
const [caseNumber,phase]=process.argv.slice(2)
if(!['1','2','3'].includes(caseNumber)||!['base','details'].includes(phase))throw new Error('Usage: node scripts/mvp-acceptance-ui.mjs 1|2|3 base|details')
const form=JSON.parse(await readFile(`output/acceptance/2026-09-12/case-${caseNumber}-form.json`,'utf8'))
const base=`
 await page.getByRole('button',{name:'新建空白商品',exact:true}).click();
 for(const [label,value] of [['商品货号',f.productCode],['商品标题',f.title],['品牌',f.brand],['颜色（逗号分隔）',f.colors],['尺码（逗号分隔）',f.sizes],['商品参考价（元）',f.referencePrice],['满 2 件折扣',f.discount]])await page.getByLabel(label,{exact:true}).fill(value);
 for(const [key,label] of Object.entries(labels))await page.getByLabel(label,{exact:true}).fill(f.attributes[key]);
 await page.getByRole('button',{name:'生成 / 更新规格表',exact:true}).click();
 `
const details=`
 for(const r of f.rows){for(const key of ['merchantSku','groupPrice','singlePrice','stock'])await page.getByLabel(r.color+' '+r.size+' '+key,{exact:true}).fill(r[key]);}
 for(const size of f.sizes.split(',')){await page.getByLabel(size+' 肩宽',{exact:true}).fill(f.measurements[size].shoulder);await page.getByLabel(size+' 胸围',{exact:true}).fill(f.measurements[size].chest);}
 await page.getByLabel('主图（首张为封面）',{exact:true}).setInputFiles(f.main.map(p=>p.path));
 await page.getByLabel('详情图',{exact:true}).setInputFiles(f.detail.map(p=>p.path));
 for(const color of f.colors.split(','))await page.getByLabel(color+' SKU 图',{exact:false}).setInputFiles(f.skuImages[color].path);
 await page.getByLabel('我已核对商品资料',{exact:false}).check();
 await page.getByRole('button',{name:'检查资料并载入',exact:true}).click();
 await page.getByRole('status').filter({hasText:'资料已校验并载入'}).waitFor({timeout:15000});
 `
const code=`async page=>{const f=${JSON.stringify(form)},labels=${JSON.stringify(attributeLabels)};${phase==='base'?base:details}}`
const r=spawnSync('bash',[`${process.env.HOME}/.codex/skills/playwright/scripts/playwright_cli.sh`,'-s=accept-sep12','run-code',code],{encoding:'utf8',timeout:60000})
process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.error)throw r.error;process.exitCode=r.status??1
