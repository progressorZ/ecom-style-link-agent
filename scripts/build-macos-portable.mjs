import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import {createWriteStream} from 'node:fs'
import {chmod,cp,mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'
import {Readable} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import {loadPortableApp,projectRoot,releaseRoot} from './portable-app.mjs'
import {copyRuntimeFiles} from './portable-runtime-files.mjs'

const appId=process.argv[2]??process.env.ECOM_APP_ID??'pdd-womenswear-tshirt'
const {app,appDirectory,adapterDirectory,backendEntry,packageDocuments}=await loadPortableApp(appId,'macos-universal')
const bundleName=`${app.id}-v${app.version}-macos-universal`,stage=resolve(releaseRoot,bundleName),appDist=resolve(releaseRoot,`.dist-${app.id}-macos-universal`)
const nodeVersion='24.15.0',nodeBase=`https://nodejs.org/dist/v${nodeVersion}`,archives={arm64:`node-v${nodeVersion}-darwin-arm64.tar.gz`,x64:`node-v${nodeVersion}-darwin-x64.tar.gz`}
const runtimeCache=resolve(projectRoot,'.runtime/portable-build-cache')

async function run(command,args,options={}){await new Promise((done,reject)=>{const child=spawn(command,args,{stdio:'inherit',...options});child.on('error',reject);child.on('exit',code=>code===0?done():reject(new Error(`${command} 退出码 ${code}`)))})}
async function download(url,path){const response=await fetch(url,{redirect:'follow'});if(!response.ok||!response.body)throw new Error(`下载失败 ${response.status}：${url}`);await pipeline(Readable.fromWeb(response.body),createWriteStream(path,{flags:'wx'}))}
const sha256=async path=>createHash('sha256').update(await readFile(path)).digest('hex')

await mkdir(releaseRoot,{recursive:true});await rm(stage,{recursive:true,force:true});await rm(appDist,{recursive:true,force:true})
console.log(`构建独立前端：${app.displayName}`)
await run(process.execPath,[resolve(projectRoot,'node_modules/typescript/bin/tsc'),'-b'],{cwd:projectRoot})
await run(process.execPath,[resolve(projectRoot,'node_modules/vite/bin/vite.js'),'build','--outDir',appDist,'--emptyOutDir'],{cwd:projectRoot,env:{...process.env,ECOM_APP_ID:app.id}})
await mkdir(stage,{recursive:true});await cp(appDist,resolve(stage,'dist'),{recursive:true});await rm(appDist,{recursive:true,force:true})
const runtimeFiles=await copyRuntimeFiles(stage,[backendEntry,resolve(projectRoot,'scripts/portable-launcher.mjs'),resolve(projectRoot,'scripts/static-server.mjs'),resolve(projectRoot,'scripts/workbench-doctor.mjs')])
await cp(appDirectory,resolve(stage,'app'),{recursive:true});await cp(adapterDirectory,resolve(stage,'adapter'),{recursive:true})
for(const name of ['LICENSE','NOTICE'])await cp(resolve(projectRoot,name),resolve(stage,name))
let appReadme=await readFile(resolve(appDirectory,'README.md'),'utf8')
for(const document of packageDocuments){const target=resolve(stage,document.target);await mkdir(dirname(target),{recursive:true});await cp(document.source,target);appReadme=appReadme.replaceAll(`../../${document.target}`,document.target)}
await writeFile(resolve(stage,'README-App.md'),appReadme)
for(const name of ['Start-PDD-Assistant.command','Diagnose-PDD-Assistant.command','README-macOS.txt'])await cp(resolve(projectRoot,'macos-portable',name),resolve(stage,name))
await chmod(resolve(stage,'Start-PDD-Assistant.command'),0o755);await chmod(resolve(stage,'Diagnose-PDD-Assistant.command'),0o755)
await mkdir(resolve(stage,'data'),{recursive:true});await writeFile(resolve(stage,'data','DO-NOT-SHARE.txt'),'商品资料、图片副本、任务报告和专用浏览器登录状态保存在这里。更新时备份此目录；使用后不要分享给他人。\n')
await cp(resolve(projectRoot,'portable-runtime/package.json'),resolve(stage,'package.json'));await cp(resolve(projectRoot,'portable-runtime/package-lock.json'),resolve(stage,'package-lock.json'))
await writeFile(resolve(stage,'BUILD-INFO.json'),JSON.stringify({appId:app.id,appVersion:app.version,target:'macos-universal',nodeVersion,entryPath:app.entryPath,runtimeFiles,builtAt:new Date().toISOString()},null,2))
console.log('安装 macOS 便携版运行依赖…')
await run('npm',['ci','--omit=dev','--omit=optional','--ignore-scripts','--no-audit','--no-fund'],{cwd:stage,env:{...process.env,PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:'1'}})

await mkdir(runtimeCache,{recursive:true});const checksPath=resolve(runtimeCache,`SHASUMS256-node-v${nodeVersion}.txt`)
let checks;try{checks=await readFile(checksPath,'utf8')}catch{await download(`${nodeBase}/SHASUMS256.txt`,checksPath);checks=await readFile(checksPath,'utf8')}
await mkdir(resolve(stage,'runtime'),{recursive:true})
for(const [arch,archive] of Object.entries(archives)){
 const archivePath=resolve(runtimeCache,archive),expected=checks.split(/\r?\n/).find(line=>line.endsWith(`  ${archive}`))?.split(/\s+/)[0]
 if(!expected)throw new Error(`Node.js ${arch} 运行时缺少官方校验值`)
 let cached=false;try{cached=await sha256(archivePath)===expected}catch{}
 if(!cached){await rm(archivePath,{force:true});await download(`${nodeBase}/${archive}`,archivePath)}
 if(await sha256(archivePath)!==expected){await rm(archivePath,{force:true});throw new Error(`Node.js ${arch} 运行时校验失败`)}
 const extractRoot=resolve(releaseRoot,`.node-${app.id}-${arch}`);await rm(extractRoot,{recursive:true,force:true});await mkdir(extractRoot,{recursive:true});await run('tar',['-xzf',archivePath,'-C',extractRoot])
 const extracted=resolve(extractRoot,archive.replace('.tar.gz',''))
 await cp(resolve(extracted,'bin/node'),resolve(stage,'runtime',`node-${arch}.runtime`));await chmod(resolve(stage,'runtime',`node-${arch}.runtime`),0o700)
 if(arch==='arm64'){await cp(resolve(extracted,'LICENSE'),resolve(stage,'runtime/NODE-LICENSE.txt'));await cp(resolve(extracted,'README.md'),resolve(stage,'runtime/NODE-README.md'))}
 await rm(extractRoot,{recursive:true,force:true})
}
console.log('验证全新数据目录启动及网页/API连接…');await run(process.execPath,[resolve(projectRoot,'scripts/portable-smoke-test.mjs'),stage],{cwd:projectRoot})
const zipPath=resolve(releaseRoot,`${bundleName}.zip`),temporary=resolve(releaseRoot,`${bundleName}.tmp.zip`);await rm(zipPath,{force:true});await rm(temporary,{force:true})
console.log('生成 macOS 通用免安装 ZIP…');await run('zip',['-q','-r',temporary,bundleName],{cwd:releaseRoot});await rename(temporary,zipPath)
const digest=await sha256(zipPath);await writeFile(zipPath+'.sha256',`${digest}  ${bundleName}.zip\n`)
console.log(`已生成：${zipPath}\nSHA-256：${digest}`)
