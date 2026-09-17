import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import {cp,chmod,mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createWriteStream} from 'node:fs'
import {Readable} from 'node:stream'
import {pipeline} from 'node:stream/promises'

const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const releaseRoot=resolve(projectRoot,'release')
const app=JSON.parse(await readFile(resolve(projectRoot,'apps/pdd-womenswear-tshirt/app.json'),'utf8'))
const bundleName=`${app.id}-v${app.version}-macos-universal`
const stage=resolve(releaseRoot,bundleName)
const nodeVersion='24.15.0',nodeBase=`https://nodejs.org/dist/v${nodeVersion}`
const archives={arm64:`node-v${nodeVersion}-darwin-arm64.tar.gz`,x64:`node-v${nodeVersion}-darwin-x64.tar.gz`}

async function run(command,args,options={}){
 await new Promise((done,reject)=>{const child=spawn(command,args,{stdio:'inherit',...options});child.on('error',reject);child.on('exit',code=>code===0?done():reject(new Error(`${command} 退出码 ${code}`)))})
}
async function download(url,path){
 const response=await fetch(url,{redirect:'follow'})
 if(!response.ok||!response.body)throw new Error(`下载失败 ${response.status}：${url}`)
 await pipeline(Readable.fromWeb(response.body),createWriteStream(path,{flags:'wx'}))
}
const sha256=async path=>createHash('sha256').update(await readFile(path)).digest('hex')

await mkdir(releaseRoot,{recursive:true});await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true})
for(const name of ['dist','scripts','src','schemas','config','examples'])await cp(resolve(projectRoot,name),resolve(stage,name),{recursive:true})
await cp(resolve(projectRoot,'apps',app.id),resolve(stage,'app'),{recursive:true})
await cp(resolve(projectRoot,'adapters/pdd-womenswear-tshirt'),resolve(stage,'adapter'),{recursive:true})
for(const name of ['LICENSE','NOTICE'])await cp(resolve(projectRoot,name),resolve(stage,name))
for(const name of ['Start-PDD-Assistant.command','Diagnose-PDD-Assistant.command','README-macOS.txt'])await cp(resolve(projectRoot,'macos-portable',name),resolve(stage,name))
await chmod(resolve(stage,'Start-PDD-Assistant.command'),0o755);await chmod(resolve(stage,'Diagnose-PDD-Assistant.command'),0o755)
await mkdir(resolve(stage,'data'),{recursive:true});await writeFile(resolve(stage,'data','DO-NOT-SHARE.txt'),'商品资料、图片副本、任务报告和专用浏览器登录状态保存在这里。更新时备份此目录；使用后不要分享给他人。\n')
await writeFile(resolve(stage,'package.json'),JSON.stringify({name:app.id+'-portable',version:app.version,license:'Apache-2.0',private:true,type:'module',dependencies:{ajv:'8.20.0','ajv-formats':'3.0.1',playwright:'1.63.0'}},null,2))
console.log('安装 macOS 便携版运行依赖…')
await run('npm',['install','--omit=dev','--omit=optional','--ignore-scripts','--no-audit','--no-fund'],{cwd:stage,env:{...process.env,PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:'1'}})

const checksPath=resolve(releaseRoot,'SHASUMS256.txt');await rm(checksPath,{force:true});await download(`${nodeBase}/SHASUMS256.txt`,checksPath)
const checks=await readFile(checksPath,'utf8');await mkdir(resolve(stage,'runtime'),{recursive:true})
for(const [arch,archive] of Object.entries(archives)){
 const archivePath=resolve(releaseRoot,archive);await rm(archivePath,{force:true});await download(`${nodeBase}/${archive}`,archivePath)
 const expected=checks.split(/\r?\n/).find(line=>line.endsWith(`  ${archive}`))?.split(/\s+/)[0],actual=await sha256(archivePath)
 if(!expected||expected!==actual)throw new Error(`Node.js ${arch} 运行时校验失败`)
 const extractRoot=resolve(releaseRoot,`.node-${arch}`);await rm(extractRoot,{recursive:true,force:true});await mkdir(extractRoot,{recursive:true})
 await run('tar',['-xzf',archivePath,'-C',extractRoot])
 await cp(resolve(extractRoot,archive.replace('.tar.gz',''),'bin/node'),resolve(stage,'runtime',`node-${arch}.runtime`));await chmod(resolve(stage,'runtime',`node-${arch}.runtime`),0o700)
 await rm(extractRoot,{recursive:true,force:true});await rm(archivePath,{force:true})
}
await rm(checksPath,{force:true})
const zipPath=resolve(releaseRoot,`${bundleName}.zip`),temporary=resolve(releaseRoot,`${bundleName}.tmp.zip`)
await rm(zipPath,{force:true});await rm(temporary,{force:true})
console.log('生成 macOS 通用免安装 ZIP…');await run('zip',['-q','-r',temporary,bundleName],{cwd:releaseRoot});await rename(temporary,zipPath)
const digest=await sha256(zipPath);await writeFile(zipPath+'.sha256',`${digest}  ${bundleName}.zip\n`)
console.log(`已生成：${zipPath}\nSHA-256：${digest}`)
