import {createServer,request as httpRequest} from 'node:http'
import {readFile,stat} from 'node:fs/promises'
import {extname,resolve,sep} from 'node:path'
import {pathToFileURL} from 'node:url'

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'}

export function createStaticServer({root=resolve('dist'),apiPort=Number(process.env.ECOM_API_PORT||4318)}={}){
 return createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1')
   if(url.pathname.startsWith('/api/live/')){
    const headers={...req.headers,host:`127.0.0.1:${apiPort}`}
    const upstream=httpRequest({hostname:'127.0.0.1',port:apiPort,path:req.url,method:req.method,headers},response=>{res.writeHead(response.statusCode??502,response.headers);response.pipe(res)})
    upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify({error:'本机后台未启动或连接失败'}))})
    req.pipe(upstream)
    return
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end()}
   const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html'
   let path=resolve(root,relative)
   if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);return res.end()}
   try{if(!(await stat(path)).isFile())throw new Error('not-file')}catch{path=resolve(root,'index.html')}
   const body=await readFile(path)
   res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream','cache-control':path.endsWith('index.html')?'no-store':'private, max-age=86400','x-content-type-options':'nosniff'})
   res.end(req.method==='HEAD'?undefined:body)
  }catch(error){res.writeHead(500,{'content-type':'text/plain; charset=utf-8'});res.end('工作台页面读取失败：'+error.message)}
 })
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const port=Number(process.env.ECOM_STATIC_PORT||5173),server=createStaticServer()
 server.listen(port,'127.0.0.1',()=>console.log(`网页工作台：http://127.0.0.1:${port}/`))
 const stop=()=>server.close(()=>process.exit(0))
 process.on('SIGINT',stop);process.on('SIGTERM',stop)
}
