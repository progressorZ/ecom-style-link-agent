import test from 'node:test'
import assert from 'node:assert/strict'
import {loadRepositoryContracts,validateRepositoryContracts} from './repository-contracts.mjs'

const clone=value=>structuredClone(value)

test('repository profiles, page contracts and adapters stay semantically aligned',async()=>{
 const repository=await loadRepositoryContracts()
 assert.deepEqual(validateRepositoryContracts(repository),[])
})

test('semantic checker rejects unknown profiles, duplicate keys and requiredness drift',async()=>{
 const repository=await loadRepositoryContracts(),base=repository.contracts[0]
 const unknown=clone(repository);unknown.contracts[0].contract.profileId='missing-profile'
 assert.ok(validateRepositoryContracts(unknown).some(error=>error.includes('未知 Profile')))

 const duplicate=clone(repository);duplicate.contracts[0].contract.fields.push(clone(duplicate.contracts[0].contract.fields[0]))
 assert.ok(validateRepositoryContracts(duplicate).some(error=>error.includes('internalKey 重复')))

 const drift=clone(repository),profile=drift.registry.profiles.find(item=>item.id===base.contract.profileId),attribute=profile.attributeFields[0],field=drift.contracts[0].contract.fields.find(item=>item.internalKey===attribute.key)
 field.workbenchRequired=!attribute.required
 assert.ok(validateRepositoryContracts(drift).some(error=>error.includes('workbenchRequired')&&error.includes('不一致')))
})

test('semantic checker keeps execution disabled until readback evidence is complete',async()=>{
 const repository=await loadRepositoryContracts(),changed=clone(repository),contract=changed.contracts[0].contract
 contract.executionEnabled=true
 const errors=validateRepositoryContracts(changed)
 assert.ok(errors.some(error=>error.includes('尚未完成 readback-verified')))
 assert.ok(errors.some(error=>error.includes('test-report')))
})
