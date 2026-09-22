import test from 'node:test'
import assert from 'node:assert/strict'
import {loadPortableApp,portableEntryPath} from './portable-app.mjs'

test('both registered apps expose isolated portable entrypoints and builds',async()=>{
 const tshirt=await loadPortableApp('pdd-womenswear-tshirt','windows-x64')
 const shoes=await loadPortableApp('pdd-board-shoes','macos-universal')
 assert.equal(portableEntryPath(tshirt.app),'/')
 assert.equal(portableEntryPath(shoes.app),'/')
 assert.notEqual(tshirt.app.dataNamespace,shoes.app.dataNamespace)
 assert.notEqual(tshirt.frontendEntry,shoes.frontendEntry)
 assert.notEqual(tshirt.backendEntry,shoes.backendEntry)
 assert.notEqual(tshirt.adapterDirectory,shoes.adapterDirectory)
 assert.ok(tshirt.packageDocuments.some(item=>item.target==='使用说明.md'))
 assert.ok(shoes.packageDocuments.some(item=>item.target==='docs/60-pdd-board-shoes-discovery.md'))
})

test('portable entrypoint cannot leave the local workbench origin',()=>{
 for(const entryPath of ['https://example.com/','//example.com/','/ok#fragment'])assert.throws(()=>portableEntryPath({id:'bad',entryPath}),/entryPath/)
})
