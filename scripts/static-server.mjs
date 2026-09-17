import {createServer} from 'node:http'
import {readFile,stat} from 'node:fs/promises'
import {extname,resolve,sep} from 'node:path'

const root=resolve('dist')
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'}
const server=createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end()}
  const url=new URL(req.url,'http://127.0.0.1')
  const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html'
  let path=resolve(root,relative)
  if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);return res.end()}
  try{if(!(await stat(path)).isFile())throw new Error('not-file')}catch{path=resolve(root,'index.html')}
  const body=await readFile(path)
  res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream','cache-control':path.endsWith('index.html')?'no-store':'private, max-age=86400','x-content-type-options':'nosniff'})
  res.end(req.method==='HEAD'?undefined:body)
 }catch(error){res.writeHead(500,{'content-type':'text/plain; charset=utf-8'});res.end('工作台页面读取失败：'+error.message)}
})
const port=Number(process.env.ECOM_STATIC_PORT||5173)
server.listen(port,'127.0.0.1',()=>console.log(`网页工作台：http://127.0.0.1:${port}/`))
const stop=()=>server.close(()=>process.exit(0))
process.on('SIGINT',stop);process.on('SIGTERM',stop)
