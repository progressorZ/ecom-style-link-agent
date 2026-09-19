import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createWorkbenchBackup,restoreWorkbenchBackup} from './workbench-backup.mjs'

test('business data backup round trips files without browser profile',async()=>{const base=await mkdtemp(join(tmpdir(),'ecom-backup-')),root=join(base,'live');try{await mkdir(join(root,'assets'),{recursive:true});await writeFile(join(root,'settings.json'),'old');await writeFile(join(root,'assets','a.png'),Buffer.from([1,2,3]));const backup=await createWorkbenchBackup(root);assert.equal(backup.entries.length,2);await writeFile(join(root,'settings.json'),'changed');const result=await restoreWorkbenchBackup(root,backup);assert.equal(result.restartRequired,true);assert.equal(await readFile(join(root,'settings.json'),'utf8'),'old');assert.deepEqual(await readFile(join(root,'assets','a.png')),Buffer.from([1,2,3]))}finally{await rm(base,{recursive:true,force:true})}})

test('restore rejects traversal and changed content',async()=>{const base=await mkdtemp(join(tmpdir(),'ecom-backup-')),root=join(base,'live');try{await assert.rejects(()=>restoreWorkbenchBackup(root,{format:'ecom-workbench-backup',version:1,entries:[{path:'../escape',size:1,sha256:'x',data:'YQ=='}]}),/不安全/)}finally{await rm(base,{recursive:true,force:true})}})
