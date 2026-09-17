import { describe, expect, it } from 'vitest'
import { initialProduct, parseNumericInput, validMoney, totalStock, validateProduct } from './domain'

describe('product validation', () => {
  it('accepts the supplied development fixture', () => {
    expect(validateProduct(initialProduct).filter((item) => item.severity === 'blocking')).toEqual([])
    expect(totalStock(initialProduct)).toBe(65)
  })

  it('rejects a missing SKU image and a duplicate color-size pair', () => {
    const broken = {
      ...initialProduct,
      variants: [
        ...initialProduct.variants,
        { ...initialProduct.variants[0], id: 'duplicate', merchantSku: 'A001-DUP', image: 'missing' }
      ]
    }
    const issues = validateProduct(broken)
    expect(issues.map((item) => item.id)).toContain('duplicate-duplicate')
    expect(issues.map((item) => item.id)).toContain('image-duplicate')
  })

  it('requires a size row for every sales size', () => {
    const broken = { ...initialProduct, sizeRows: initialProduct.sizeRows.filter((row) => row.size !== 'M') }
    expect(validateProduct(broken).some((item) => item.id === 'size-M')).toBe(true)
  })

  it('checks the two platform prices and reference price relationship', () => {
    const broken = {
      ...initialProduct,
      referencePrice: 130,
      variants: initialProduct.variants.map((variant, index) => index === 0 ? { ...variant, singlePrice: Number(variant.groupPrice) - 1 } : variant)
    }
    const issueIds = validateProduct(broken).map((item) => item.id)
    expect(issueIds).toContain('single-price-black-s')
    expect(issueIds).toContain('reference-price')
  })

  it('requires size linkage configuration and excludes disabled rows from sellable stock', () => {
    const withoutTemplate = { ...initialProduct, sizeTemplate: '' }
    expect(validateProduct(withoutTemplate).some((item) => item.id === 'size-template')).toBe(true)
    const oneDisabled = {
      ...initialProduct,
      variants: initialProduct.variants.map((variant, index) => index === 0 ? { ...variant, enabled: false } : variant)
    }
    expect(totalStock(oneDisabled)).toBe(45)
  })
})

 it('preserves missing numeric input and validates exact cents', () => {
   expect(parseNumericInput('')).toBe('')
   expect(parseNumericInput('0')).toBe(0)
   expect(validMoney(0.29)).toBe(true)
   expect(validMoney(129.001)).toBe(false)
   for (const field of ['groupPrice', 'singlePrice', 'stock'] as const) {
     const product = structuredClone(initialProduct)
     product.variants[0][field] = ''
     expect(validateProduct(product).some((item) => item.severity === 'blocking')).toBe(true)
   }
 })
 it('rejects empty variants, duplicate identifiers, invalid dimensions and sub-cent prices', () => {
   const changes = [
     (p: typeof initialProduct) => { p.variants = [] },
     (p: typeof initialProduct) => { p.variants[1].merchantSku = p.variants[0].merchantSku },
     (p: typeof initialProduct) => { p.variants[1].id = p.variants[0].id },
     (p: typeof initialProduct) => { p.sizeRows[0].length = -1 },
     (p: typeof initialProduct) => { p.sizeRows.push(p.sizeRows[0]) },
     (p: typeof initialProduct) => { p.variants[0].groupPrice = 129.001 },
     (p: typeof initialProduct) => { p.referencePrice = 169.001 },
     (p: typeof initialProduct) => { p.gramsPerSquareMeter = '' }
   ]
   for (const change of changes) {
     const product = structuredClone(initialProduct); change(product)
     expect(validateProduct(product).some((item) => item.severity === 'blocking')).toBe(true)
   }
 })
