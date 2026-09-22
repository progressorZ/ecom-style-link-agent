import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import {createWriteStream} from 'node:fs'
import {cp,mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'
import {Readable} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import {unzipSync} from 'fflate'
import {loadPortableApp,projectRoot,releaseRoot} from './portable-app.mjs'
import {copyRuntimeFiles} from './portable-runtime-files.mjs'

const appId=process.argv[2]??process.env.ECOM_APP_ID??'pdd-womenswear-tshirt'
const {app,appDirectory,adapterDirectory,backendEntry,packageDocuments}=await loadPortableApp(appId,'windows-x64')
const bundleName=`${app.id}-v${app.version}-windows-x64`,stage=resolve(releaseRoot,bundleName)
const appDist=resolve(releaseRoot,`.dist-${app.id}-windows-x64`)
const nodeVersion='24.15.0',nodeArchive=`node-v${nodeVersion}-win-x64.zip`
const nodeArchiveSha256='cc5149eabd53779ce1e7bdc5401643622d0c7e6800ade18928a767e940bb0e62'
const runtimeCache=resolve(projectRoot,'.runtime/portable-build-cache')

async function run(command,args,options={}){await new Promise((done,reject)=>{const child=spawn(command,args,{stdio:'inherit',...options});child.on('error',reject);child.on('exit',code=>code===0?done():reject(new Error(`${command} 退出码 ${code}`)))})}
const sha256=async path=>createHash('sha256').update(await readFile(path)).digest('hex')
async function download(url,path){const response=await fetch(url,{redirect:'follow'});if(!response.ok||!response.body)throw new Error(`下载 Node.js 官方运行时失败：HTTP ${response.status}`);await pipeline(Readable.fromWeb(response.body),createWriteStream(path,{flags:'wx'}))}

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
for(const [source,target] of [['启动拼多多上新助手.cmd','Start-PDD-Assistant.cmd'],['诊断助手.cmd','Diagnose-PDD-Assistant.cmd'],['Windows便携版使用说明.txt','README-Windows.txt']])await cp(resolve(projectRoot,'windows-portable',source),resolve(stage,target))
for(const name of ['Start-PDD-Assistant.cmd','Diagnose-PDD-Assistant.cmd']){const text=(await readFile(resolve(stage,name),'utf8')).replace(/\r?\n/g,'\r\n');await writeFile(resolve(stage,name),text)}
await mkdir(resolve(stage,'data'),{recursive:true});await writeFile(resolve(stage,'data','DO-NOT-SHARE.txt'),'商品资料、图片副本、任务报告和专用浏览器登录状态保存在这里。更新时备份此目录；使用后不要分享给他人。\r\n')
await cp(resolve(projectRoot,'portable-runtime/package.json'),resolve(stage,'package.json'));await cp(resolve(projectRoot,'portable-runtime/package-lock.json'),resolve(stage,'package-lock.json'))
await writeFile(resolve(stage,'BUILD-INFO.json'),JSON.stringify({appId:app.id,appVersion:app.version,target:'windows-x64',nodeVersion,entryPath:app.entryPath,runtimeFiles,builtAt:new Date().toISOString()},null,2))
console.log('安装 Windows 便携版运行依赖…')
await run(process.platform==='win32'?'npm.cmd':'npm',['ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund','--os=win32','--cpu=x64'],{cwd:stage,env:{...process.env,PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:'1'}})

await mkdir(runtimeCache,{recursive:true});const archivePath=resolve(runtimeCache,nodeArchive)
let cached=false;try{cached=await sha256(archivePath)===nodeArchiveSha256}catch{}
if(!cached){await rm(archivePath,{force:true});console.log('构建时下载并校验 Node.js 官方 Windows 运行时…');await download(`https://nodejs.org/dist/v${nodeVersion}/${nodeArchive}`,archivePath)}else console.log('使用已校验的 Node.js Windows 运行时缓存…')
if(await sha256(archivePath)!==nodeArchiveSha256){await rm(archivePath,{force:true});throw new Error('Node.js 官方运行时 SHA-256 不符，停止打包')}
const entries=unzipSync(new Uint8Array(await readFile(archivePath))),prefix=`node-v${nodeVersion}-win-x64/`
await mkdir(resolve(stage,'runtime'),{recursive:true})
for(const [source,target] of [['node.exe','node.exe'],['LICENSE','NODE-LICENSE.txt'],['README.md','NODE-README.md']]){const bytes=entries[prefix+source];if(!bytes)throw new Error(`Node.js 官方压缩包缺少 ${source}`);await writeFile(resolve(stage,'runtime',target),bytes)}

console.log('验证全新数据目录启动及网页/API连接…');await run(process.execPath,[resolve(projectRoot,'scripts/portable-smoke-test.mjs'),stage],{cwd:projectRoot})
const zipPath=resolve(releaseRoot,`${bundleName}.zip`),temporary=resolve(releaseRoot,`${bundleName}.tmp.zip`);await rm(temporary,{force:true});await rm(zipPath,{force:true})
console.log('生成 Windows 免安装 ZIP…')
if(process.platform==='win32')await run('tar.exe',['-a','-c','-f',temporary,bundleName],{cwd:releaseRoot});else await run('zip',['-q','-r',temporary,bundleName],{cwd:releaseRoot})
await rename(temporary,zipPath);const digest=await sha256(zipPath);await writeFile(zipPath+'.sha256',`${digest}  ${bundleName}.zip\n`)
console.log(`已生成：${zipPath}\nSHA-256：${digest}`)
