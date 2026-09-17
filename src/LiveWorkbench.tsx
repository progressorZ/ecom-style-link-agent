import {useEffect,useState} from 'react'
import './live-workbench.css'
import ProductEntry from './ProductEntry'
import {explainLiveMessage} from './live-messages'
type Check={id:string;status:string;reason?:string;expected?:unknown;observed?:unknown}
type Report={counts?:Record<string,number>;checks?:Check[];blockers?:{path:string;reason:string}[];shopIdentity?:{status:string}}
type Job={id:string;editorUrl?:string;sourceHash?:string;action:string;status:string;productCode:string;createdAt:string;error?:string;reviews?:{decision:string;note:string;reviewedAt:string}[];events:{step:string;index?:number;total?:number}[];result?:{status:string;saved:boolean;published:boolean;productUrl?:string;goodsId?:string;draftExists?:boolean;repair?:{changedFields:string[];manualChecks:string[]};report?:Report}}
type State={busy:boolean;loaded:null|{identity:{productCode:string};shop:{shopName:string;mallId:string};title:string;steps:string[];blockers:{reason:string}[]};pages:{id:string;url:string}[];jobs:Job[]}
const labels:Record<string,string>={repair:'修正标题及属性差异','repair-basic':'修正标题','repair-brand':'修正品牌','repair-attributes':'修正服装属性','recover-draft':'核查历史草稿','reconcile-draft':'核查已保存内容','publication-result':'读取发布结果','lookup-publication-result':'查找商品状态与链接','reopen-draft':'从草稿箱重开核对','open-matching-draft':'打开对应草稿',inspect:'核对商品',fill:'填写并核对','save-draft':'保存草稿并重开',basic:'基础信息',brand:'品牌',attributes:'商品属性',elements:'流行元素',style:'风格',fabric:'面料',matrixAndSku:'颜色尺码及库存',pricing:'价格',size:'尺码表',sizeSync:'尺码同步',carousel:'主图',skuImages:'颜色规格图片',detail:'详情图',shipping:'发货时效',freight:'运费规则',services:'服务承诺','reopen-and-readback':'重开草稿并核对'}
async function request(path:string,body?:unknown){const r=await fetch('/api/live/'+path,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{throw new Error('后台服务未连接，请先运行 npm run workbench:start')}if(!r.ok)throw new Error(explainLiveMessage(data.error||'请求失败'));return data}
export default function LiveWorkbench(){
 const [state,setState]=useState<State|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false)
 const [product,setProduct]=useState(''),[config,setConfig]=useState(''),[names,setNames]=useState({product:'未选择',config:'未选择'}),[dirty,setDirty]=useState(false),[pageId,setPageId]=useState(''),[activeJob,setActiveJob]=useState<string|null>(null)
 async function refresh(){try{const next=await request('state');setState(next);return next}catch(e){setError(e instanceof Error?e.message:'无法连接后台')}}
 useEffect(()=>{let alive=true;const poll=async()=>{try{const next=await request('state');if(alive)setState(next)}catch(e){if(alive)setError(e instanceof Error?e.message:'无法连接后台')}};void poll();const timer=setInterval(poll,2000);return()=>{alive=false;clearInterval(timer)}},[])
 const pages=state?.pages.filter(p=>p.url.startsWith('https://mms.pinduoduo.com/goods/goods_add/index'))??[]
 const selected=pages.some(p=>p.id===pageId)?pageId:pages.length===1?pages[0].id:''
 const disabled=pending||state?.busy===true
 async function perform(fn:()=>Promise<unknown>){setPending(true);setError('');try{await fn();await refresh()}catch(e){setError(e instanceof Error?e.message:'操作失败')}finally{setPending(false)}}
 async function file(kind:'product'|'config',f?:File){if(!f)return;setDirty(true);setNames(n=>({...n,[kind]:f.name}));const text=await f.text();if(kind==='product')setProduct(text);else setConfig(text)}
 const [reviewFlags,setReviewFlags]=useState<Record<string,boolean>>({}),[reviewNote,setReviewNote]=useState('')
 useEffect(()=>{setReviewFlags({});setReviewNote('')},[activeJob,state?.jobs[0]?.id])
 const latest=state?.jobs.find(j=>j.id===activeJob)??state?.jobs.find(j=>j.productCode===state.loaded?.identity.productCode),report=latest?.result?.report
 return <div className="live-workbench">
  <header className="live-top"><div><span className="live-eyebrow">服装商品上新 · MVP</span><h1>拼多多单款工作台</h1><p>录入资料 → 自动填表 → 核对 → 人工发布。一次处理一款 T 恤。</p></div><span className={'live-badge '+(state?'connected':'')}>{state?'本机服务已连接':'等待后台服务'}</span></header>
  {error&&<div className="live-error" role="alert">{error}<button onClick={()=>{setError('');void refresh()}}>重新连接</button></div>}
  <ProductEntry disabled={disabled} request={request} onDirty={()=>setDirty(true)} onLoaded={()=>{setDirty(false);setActiveJob(null);void refresh()}}/>
  <div className="live-grid"><section className="live-card"><h2>当前载入商品</h2><details><summary>开发者工具：JSON 导入</summary><p>JSON 只用于系统内部交换和故障排查。普通用户无需查看或确认 JSON，请使用上方商品表单。</p>
   <label className="live-file">商品 JSON <input type="file" accept=".json,application/json" disabled={disabled} onChange={e=>void file('product',e.target.files?.[0])}/><small>{names.product}</small></label>
   <label className="live-file">店铺核验配置 JSON <input type="file" accept=".json,application/json" disabled={disabled} onChange={e=>void file('config',e.target.files?.[0])}/><small>{names.config}</small></label>
   <button className="live-primary" disabled={disabled||!product||!config} onClick={()=>void perform(async()=>{await request('package',{input:JSON.parse(product),options:JSON.parse(config)});setDirty(false)})}>校验并载入</button>
   </details>
   {state?.loaded&&<div className="live-product"><strong>{state.loaded.title}</strong><dl><dt>货号</dt><dd>{state.loaded.identity.productCode}</dd><dt>目标店铺</dt><dd>{state.loaded.shop.shopName}</dd><dt>店铺编号</dt><dd>{state.loaded.shop.mallId}</dd></dl>{dirty&&<p className="live-warning">录入资料待校验，请检查后重新载入。继续上一款可点击“继续编辑当前商品”。</p>}</div>}
  </section><section className="live-card"><h2>2. 准备商家页面</h2><p>打开专用浏览器并登录，选择“女装/女士精品 → T恤 → T恤”，进入商品编辑页。</p>
   <button disabled={disabled||!state} onClick={()=>void perform(()=>request('browser',{}))}>打开商家浏览器</button>
   {state?.pages.some(p=>p.url.startsWith("https://mms.pinduoduo.com/login"))&&<p className="live-warning">商家浏览器已打开，请先在该窗口登录。</p>}
   <label className="live-select">目标编辑页<select value={selected} disabled={disabled} onChange={e=>setPageId(e.target.value)}><option value="">{pages.length?'请选择页面':'尚未找到编辑页'}</option>{pages.map((p,i)=><option value={p.id} key={p.id}>页面 {i+1} · {new URL(p.url).searchParams.get('id')||'新商品'}</option>)}</select></label>
   {selected&&<small className="live-url">{pages.find(p=>p.id===selected)?.url}</small>}
   <p className="live-hint">页面列表自动刷新。新商品货号可以为空；已有货号必须与输入一致。</p>
  </section></div>
  <section className="live-card"><h2>3. 执行与审核</h2><div className="live-actions">{(['fill','inspect','repair','save-draft','reopen-draft','publication-result'] as const).map(action=><button key={action} className={action==='fill'?'live-primary':''} disabled={disabled||!state?.loaded||dirty||!selected} onClick={()=>void perform(async()=>{await request('jobs',{action,pageId:selected});setActiveJob(null)})}>{labels[action]}</button>)}</div><p className="live-hint">首次填写适用于空白素材区。发现差异后，可单独修正标题、品牌和已支持的服装属性，再保存草稿。价格、库存及图片差异仍需人工处理；工作台不会自动发布。</p>
   {latest?<div className="live-result"><div className="live-result-title"><strong>{labels[latest.action]} · {latest.productCode}</strong><span>{latest.status==='running'?'执行中':latest.status==='completed'?'操作已结束，请审核':'需要检查'}</span></div>
    {latest.events.length>0&&<ol className="live-events">{latest.events.map((e,i)=><li key={i}>{labels[e.step]||e.step}{e.total?`（${e.index}/${e.total}）`:''}</li>)}</ol>}
    {latest.error&&<p className="live-warning">已停止：{explainLiveMessage(latest.error)}。先核对当前页面，不要直接重复执行。</p>}
    {latest.result&&<p>本次保存：{latest.result.saved?'已执行':'未执行'}{latest.result.draftExists?'；已找到历史草稿':''}；在售状态：{latest.result.published?'已从商品列表确认':'尚未确认'}。{latest.result.productUrl&&<a href={latest.result.productUrl} target="_blank" rel="noreferrer">打开商品链接</a>}</p>}
    {latest.result?.repair&&<p>本次修正 {latest.result.repair.changedFields.length} 个字段。{latest.result.repair.manualChecks.length?`另有 ${latest.result.repair.manualChecks.length} 项需要人工处理，请查看下方差异。`:'修正结果以完整核对报告为准。'}</p>}
    {report?.counts&&<div className="live-counts">{[['matched','匹配'],['mismatch','差异'],['unreadable','不可读取'],['unverified','待核实'],['uncovered','未覆盖']].map(([key,label])=><div key={key}><strong>{report.counts?.[key]??0}</strong><span>{label}</span></div>)}</div>}
    {report?.checks?.length?<details><summary>查看全部已核对字段及数值</summary><table><thead><tr><th>字段</th><th>期望值</th><th>实际值</th></tr></thead><tbody>{report.checks.map(c=><tr key={c.id}><td>{c.id}</td><td><pre>{JSON.stringify(c.expected,null,2)}</pre></td><td><pre>{JSON.stringify(c.observed,null,2)}</pre></td></tr>)}</tbody></table></details>:null}
    {report?.checks?.filter(c=>c.status!=='matched').map(c=><details key={c.id}><summary>{c.id} · {c.status==='unverified'?'待核实':c.status==='mismatch'?'数据差异':'需检查'}</summary><p>{c.reason}</p><pre>{JSON.stringify({期望:c.expected,实际:c.observed},null,2)}</pre></details>)}
    {report?.blockers?.length?<details><summary>平台人工核查与未覆盖项（{report.blockers.length}项）</summary><p>这些是当前商品的核查要求，可能包含本版未支持范围；不等于每项都是待开发功能。请结合上方实际差异检查，不能跳过必填要求。</p><ul>{report.blockers.map((b,i)=><li key={i}>{b.reason}</li>)}</ul></details>:null}
    {report&&latest.status==='completed'&&<div className="live-review"><h3>人工审核记录</h3><p>逐项查看实物资料与商家页面后勾选。审核记录绑定本次结果；系统待解决项仍保留。</p>{[['productAndImages','商品描述、颜色与图片和实物一致'],['priceStockAndSizes','价格、库存、尺码与实际数据一致'],['logisticsAndServices','运费、发货时效与服务承诺准确'],['brandAndQualifications','品牌及所需资质已核实']].map(([key,label])=><label key={key}><input type="checkbox" checked={reviewFlags[key]??false} onChange={e=>setReviewFlags(f=>({...f,[key]:e.target.checked}))}/>{label}</label>)}<textarea aria-label="审核备注" placeholder="审核备注，退回时必须填写原因" value={reviewNote} onChange={e=>setReviewNote(e.target.value)}/><div className="live-actions">{(['accepted','rejected'] as const).map(decision=><button disabled={disabled||dirty||!state?.loaded} key={decision} onClick={()=>void perform(()=>request('reviews',{jobId:latest.id,decision,confirmations:reviewFlags,note:reviewNote}))}>{decision==='accepted'?'记录人工审核通过':'退回修改'}</button>)}</div>{latest.reviews?.map((r,i)=><p key={i}>{r.decision==='accepted'?'人工审核通过':'退回修改'} · {new Date(r.reviewedAt).toLocaleString()} {r.note}</p>)}</div>}
    <button onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(latest,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='任务报告-'+latest.id+'.json';a.click();URL.revokeObjectURL(url)}}>下载任务报告</button>
   </div>:<p className="live-empty">载入商品并准备好编辑页后，即可开始。</p>}
  </section>
  <section className="live-card"><h2>近期任务</h2>{state?.jobs.length?<ul className="live-history">{state.jobs.map(j=><li key={j.id}><span>{j.productCode} · {labels[j.action]}</span><time>{new Date(j.createdAt).toLocaleString()}</time><span>{j.status==='running'?'执行中':j.status==='completed'?'操作结束':'需检查'}</span><button onClick={()=>setActiveJob(j.id)}>查看结果</button>{j.editorUrl&&j.sourceHash&&j.status!=='running'&&j.action!=='publication-result'&&<button disabled={disabled||dirty||!state?.loaded||!state.pages.length} onClick={()=>void perform(async()=>{await request('jobs',{action:'recover-draft',sourceJobId:j.id});setActiveJob(null)})}>找回草稿并核对</button>}</li>)}</ul>:<p>还没有真实任务记录。</p>}</section>
  <footer>单款 T 恤填表助手。图片内容、特殊资质和额外必填项由人工核实；请在拼多多手动发布并取得链接。<a href="?demo=1">打开旧版模拟演示</a></footer>
 </div>
}
