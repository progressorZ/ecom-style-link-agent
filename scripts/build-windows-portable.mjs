import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import {cp,mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {Readable} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import {createWriteStream} from 'node:fs'

const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const releaseRoot=resolve(projectRoot,'release')
const app=JSON.parse(await readFile(resolve(projectRoot,'apps/pdd-womenswear-tshirt/app.json'),'utf8'))
const bundleName=`${app.id}-v${app.version}-windows-x64`
const stage=resolve(releaseRoot,bundleName)
const nodeVersion='24.15.0'
const nodeArchive=`node-v${nodeVersion}-win-x64.zip`
const nodeArchiveSha256='cc5149eabd53779ce1e7bdc5401643622d0c7e6800ade18928a767e940bb0e62'

async function run(command,args,options={}){
 await new Promise((resolvePromise,reject)=>{
  const child=spawn(command,args,{stdio:'inherit',...options})
  child.on('error',reject)
  child.on('exit',code=>code===0?resolvePromise():reject(new Error(`${command} 退出码 ${code}`)))
 })
}
const sha256=async path=>createHash('sha256').update(await readFile(path)).digest('hex')
async function download(url,path){
 const response=await fetch(url,{redirect:'follow'})
 if(!response.ok||!response.body)throw new Error(`下载 Node.js 官方运行时失败：HTTP ${response.status}`)
 await pipeline(Readable.fromWeb(response.body),createWriteStream(path,{flags:'wx'}))
}

await mkdir(releaseRoot,{recursive:true})
await rm(stage,{recursive:true,force:true})
await mkdir(stage,{recursive:true})
for(const name of ['dist','scripts','src','schemas','config','examples'])await cp(resolve(projectRoot,name),resolve(stage,name),{recursive:true})
await rm(resolve(stage,'scripts/install-node-runtime.ps1'),{force:true})
await cp(resolve(projectRoot,'apps',app.id),resolve(stage,'app'),{recursive:true})
await cp(resolve(projectRoot,'adapters/pdd-womenswear-tshirt'),resolve(stage,'adapter'),{recursive:true})
for(const name of ['LICENSE','NOTICE'])await cp(resolve(projectRoot,name),resolve(stage,name))
for(const [source,target] of [['启动拼多多上新助手.cmd','Start-PDD-Assistant.cmd'],['诊断助手.cmd','Diagnose-PDD-Assistant.cmd'],['Windows便携版使用说明.txt','README-Windows.txt']])await cp(resolve(projectRoot,'windows-portable',source),resolve(stage,target))
// cmd.exe expects Windows line endings. Keep filenames ASCII for reliable ZIP extraction.
for(const name of ['Start-PDD-Assistant.cmd','Diagnose-PDD-Assistant.cmd']){
 const text=(await readFile(resolve(stage,name),'utf8')).replace(/\r?\n/g,'\r\n')
 await writeFile(resolve(stage,name),text)
}
await mkdir(resolve(stage,'data'),{recursive:true})
await writeFile(resolve(stage,'data','DO-NOT-SHARE.txt'),'商品资料、图片副本、任务报告和专用浏览器登录状态保存在这里。更新时备份此目录；使用后不要分享给他人。\r\n')
await writeFile(resolve(stage,'package.json'),JSON.stringify({name:app.id+'-portable',version:app.version,license:'Apache-2.0',private:true,type:'module',dependencies:{ajv:'8.20.0','ajv-formats':'3.0.1',playwright:'1.63.0'}},null,2))
console.log('安装 Windows 便携版运行依赖…')
await run(process.platform==='win32'?'npm.cmd':'npm',['install','--omit=dev','--ignore-scripts','--no-audit','--no-fund','--os=win32','--cpu=x64'],{cwd:stage,env:{...process.env,PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:'1'}})

const archivePath=resolve(releaseRoot,nodeArchive)
const extractRoot=resolve(releaseRoot,`.node-${nodeVersion}-win-x64`)
await rm(archivePath,{force:true});await rm(extractRoot,{recursive:true,force:true})
try{
 console.log('构建时下载并校验 Node.js 官方 Windows 运行时…')
 await download(`https://nodejs.org/dist/v${nodeVersion}/${nodeArchive}`,archivePath)
 if(await sha256(archivePath)!==nodeArchiveSha256)throw new Error('Node.js 官方运行时 SHA-256 不符，停止打包')
 await mkdir(extractRoot,{recursive:true})
 await run('unzip',['-q',archivePath,'-d',extractRoot])
 const extracted=resolve(extractRoot,`node-v${nodeVersion}-win-x64`)
 await mkdir(resolve(stage,'runtime'),{recursive:true})
 await cp(resolve(extracted,'node.exe'),resolve(stage,'runtime/node.exe'))
 await cp(resolve(extracted,'LICENSE'),resolve(stage,'runtime/NODE-LICENSE.txt'))
 await cp(resolve(extracted,'README.md'),resolve(stage,'runtime/NODE-README.md'))
}finally{
 await rm(extractRoot,{recursive:true,force:true})
 await rm(archivePath,{force:true})
}

const zipPath=resolve(releaseRoot,`${bundleName}.zip`),temporary=resolve(releaseRoot,`${bundleName}.tmp.zip`)
await rm(temporary,{force:true});await rm(zipPath,{force:true})
console.log('生成 Windows 免安装 ZIP…')
await run('zip',['-q','-r',temporary,bundleName],{cwd:releaseRoot})
await rename(temporary,zipPath)
const digest=await sha256(zipPath)
await writeFile(zipPath+'.sha256',`${digest}  ${bundleName}.zip\n`)
console.log(`已生成：${zipPath}\nSHA-256：${digest}`)
