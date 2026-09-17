import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {editorIdentity,readDraftRow} from './pdd-draft-list.mjs'
import {validateProductLink,readOnSaleRow} from './pdd-publication-result.mjs'
import {assertBasicScope,assertReadbackScope} from './pdd-basic-adapter.mjs'
const editor='https://mms.pinduoduo.com/goods/goods_add/index?id=12&goods_id=34&type=edit'
test('read-only draft mode does not grant existing-product write access',async()=>{
 const page={url:()=>editor,getByText:()=>({count:async()=>1})}
 await assertReadbackScope(page);await assert.rejects(()=>assertBasicScope(page),/NEW_PRODUCT/)
 for(const u of [editor+'&type=add',editor.replace('type=edit','type=delete')])await assert.rejects(()=>assertReadbackScope({...page,url:()=>u}),/MODE_INVALID/)
})
test('editor and output URLs must bind the exact goods ID',()=>{
 assert.deepEqual(editorIdentity(editor),{draftId:'12',goodsId:'34'})
 for(const u of [editor+'&goods_id=35',editor.replace('goods_id=34','goods_id='),editor.replace('mms.pinduoduo.com','evil.test')])assert.throws(()=>editorIdentity(u))
 assert.equal(validateProductLink('https://mobile.yangkeduo.com/goods.html?goods_id=34','34'),'https://mobile.yangkeduo.com/goods.html?goods_id=34')
 for(const u of ['https://mobile.yangkeduo.com/goods.html?goods_id=35','https://mobile.yangkeduo.com/goods.html?goods_id=34&goods_id=35','https://evil.test/goods.html?goods_id=34','javascript:alert(1)'])assert.throws(()=>validateProductLink(u,'34'))
})
function dom(html,fn){
 const d=new JSDOM(html);const {window:w}=d
 Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent}})
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:100,height:20})
 const old={document:globalThis.document,getComputedStyle:globalThis.getComputedStyle}
 globalThis.document=w.document;globalThis.getComputedStyle=w.getComputedStyle.bind(w)
 try{return fn()}finally{Object.assign(globalThis,old);w.close()}
}
test('draft edit type 发布 is never interpreted as publication',()=>{
 const html='<table><tr><th>商品信息</th><th>状态</th><th>编辑类型</th></tr><tr><td>样品 ID: 34 商品编码：--</td><td>编辑中</td><td>发布</td></tr></table>'
 dom(html,()=>{assert.equal(readDraftRow({goodsId:'34'}).published,false);assert.throws(()=>readOnSaleRow({goodsId:'34'}),/NOT_CONFIRMED/);assert.throws(()=>readDraftRow({goodsId:'3'}),/NOT_UNIQUE/)})
})
test('on-sale result requires status and the exact matching row',()=>{
 dom('<table><tr><td>ID: 34</td><td>销售中</td><td><a>下架</a></td></tr></table>',()=>assert.equal(readOnSaleRow({goodsId:'34'}).status,'on_sale'))
 dom('<table><tr><td>ID: 34</td><td>审核中</td><td><a>下架</a></td></tr></table>',()=>assert.throws(()=>readOnSaleRow({goodsId:'34'})))
})
