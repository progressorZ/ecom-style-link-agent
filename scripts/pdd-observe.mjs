// Self-contained callback shared by the CLI verifier and browser regression tests.
// Read-only: no input values, HTML, cookies or storage are collected.
export function observePddFields({ fields, forbiddenActions, allowedAction }) {
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim()
  const visible = (element) => {
    const style = getComputedStyle(element), box = element.getBoundingClientRect()
    return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0
  }
  const labels = [...document.querySelectorAll('label')].filter(visible)
  const fieldResults = fields.map((field) => {
    const matches = labels.filter((label) => clean(label.textContent) === field.label)
    const base = { key: field.key, label: field.label, labelCount: matches.length, controlCount: 0 }
    if (matches.length !== 1) return { ...base, status: matches.length ? 'ambiguous_label' : 'missing_label' }
    // Observed platform semantic container. Never climb into a neighbouring field.
    const container = matches[0].closest('[data-testid="beast-core-form-item"]')
    if (!container) return { ...base, status: 'missing_field_container' }
    const candidates = [...container.querySelectorAll('input,textarea,select')].filter(visible)
    if (candidates.length !== 1) return { ...base, controlCount: candidates.length, status: candidates.length ? 'ambiguous_control' : 'missing_control' }
    const input = candidates[0]
    const select = input.closest('[data-testid="beast-core-select"]')
    const customSelect = !!select && container.contains(select) && input.getAttribute('data-testid') === 'beast-core-select-htmlInput' && !!select.querySelector('[data-testid="beast-core-select-header"]')
    const multipleMarker = customSelect && [...select.querySelectorAll('[class]')].some((el) => [...el.classList].some((name) => name.startsWith('ST_selectValueMultiple_')))
    return {
      ...base, controlCount: 1, status: 'unique', locatorStatus: 'unique',
      control: {
        tag: input.tagName.toLowerCase(), type: input.getAttribute('type'), role: input.getAttribute('role'),
        placeholder: clean(input.getAttribute('placeholder')) || null,
        disabled: input.disabled || input.getAttribute('aria-disabled') === 'true', readOnly: !!input.readOnly,
        multiple: !!input.multiple || input.getAttribute('aria-multiselectable') === 'true' || !!multipleMarker,
        component: customSelect ? 'beast-core-select' : null,
        componentEvidence: customSelect ? ['beast-core-select', 'beast-core-select-header', 'beast-core-select-htmlInput'] : [],
        multipleEvidence: multipleMarker ? 'ST_selectValueMultiple_' : null
      }
    }
  })
  const visibleActionCounts = [...new Set([...forbiddenActions, allowedAction])].map((action) => ({
    action, count: [...document.querySelectorAll('button,[role="button"]')].filter(visible).filter((el) => clean(el.textContent) === action).length
  }))
  return { fieldResults, visibleActionCounts }
}
