import { expect, it } from 'vitest'
import { MockDraft, differences } from './mock-draft'
import { initialProduct } from './domain'

it('reads independent fields and detects corrupted stock, images and sizes', () => {
  const expected = structuredClone(initialProduct)
  const draft = new MockDraft<typeof expected>()
  draft.write(expected)
  expect(differences(expected, draft.read())).toEqual([])
  const altered = draft.read()
  altered.variants[0].stock = 999
  altered.variants[0].image = 'wrong-color'
  altered.sizeRows[0].length = 1
  // Read returns detached data, not an alias of the store or the input.
  expect(differences(expected, draft.read())).toEqual([])
  draft.setField('variants', altered.variants)
  draft.setField('sizeRows', altered.sizeRows)
  expect(differences(expected, draft.read())).toEqual(['/variants/0/stock', '/variants/0/image', '/sizeRows/0/length'])
})
