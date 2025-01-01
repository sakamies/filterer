/**
 * Custom element to filter contents inside it based on a form.
 * @module Filter
 * @param {string} form - Optional form name or id. If blank, the first form inside the element instance, or the first form in the document is used.
 * @param {string} rows - CSS Selector that targets the items that you want to show or hide based on the form. Doesn't have to be a table row, any element will do. Example: `#mytable .card`
 */

export class Filter extends HTMLElement {
  static observedAttributes = ['form', 'rows']
  //TODO: attribute like "exact" or something to have only exact matches?

  styleElement
  selectors = {
    attr: (name, value) => `[data-${this.localName}-${name}*="${value}" i]`,
    has: str => `:has(${str})`,
    is: str => `:is(${str})`,
    not: str => `:not(${str})`,
  }

  get form() {
    return document.forms[this.getAttribute('form')]
    || this.querySelector('form')
    || this.closest('form')
    || document.forms[0]
    || console.warn('No form found for', this)
  }

  get rows() {
    return this.querySelectorAll(this.rowsSelector)
  }

  constructor() {
    super()
    this.styleElement = this.styleElement || this.appendChild(document.createElement('style'))
    this.filterDebounced = debounce(this.filter.bind(this), 50)
    this.form && this.form.addEventListener('input', this.filterDebounced)
  }

  attributeChangedCallback(name, _, value) {
    this.filterDebounced()
  }

  dispatch(found) {
    const event = new CustomEvent(this.localName, {
      cancelable: true,
      bubbles: true,
      detail: {found},
    })
    return this.dispatchEvent(event)
  }

  filterDebounced
  filter() {
    const rows = this.querySelectorAll(this.rowsSelector)
    const data = Array.from(new FormData(this.form)).filter(([_, v]) => v)
    const rowHas = data.map(this.hasAttributeSelectors, this).join('')

    const found = this.querySelectorAll(this.rowsSelector+rowHas)
    if (!this.dispatch(found)) return

    const shown = Array.from(found)
    rows.forEach(row => row.hidden = !shown.includes(row))

    this.hilite(data.flatMap(this.hiliteSelectors, this).join(','))

    if (this.getAttribute('hideblank') !== null && data.length === 0) {
      rows.forEach(row => row.hidden = true)
    }
  }

  //TODO: If this is to be a generic filter and not a table specific filter, the default should be to filter direct children instead of table rows.
  get rowsSelector() {
    return this.getAttribute('rows') || 'tbody tr'
  }

  attributeSelectors(name, value) {
    name = CSS.escape(name)
    const words = value.trim().split(' ').map(CSS.escape)
    let attrs = words.map(word => this.selectors.attr(name, word))
    return attrs
  }

  hasAttributeSelectors([name, value], flag) {
    [name, flag] = name.split(':')
    const selector = this.attributeSelectors(name, value).map(this.selectors.has).join('')
    return flag === 'not' && this.selectors.not(selector) || selector
  }

  hiliteSelectors([name, value], flag) {
    [name, flag] = name.split(':')
    return flag === 'hi' && this.attributeSelectors(name, value) || []
  }

  hilite(attrsToHilite) {
    // TODO: this is really simple, but using Range() and ::highlight() would be more accurate. Not sure if it's worth the complexity.
    if (attrsToHilite && this.id) {
      const selector = `#${this.id} ${this.rowsSelector} ${this.selectors.is(attrsToHilite)}`
      const text = `var(--${this.localName}-marktext, MarkText)`
      const mark = `var(--${this.localName}-mark, Mark)`
      this.styleElement.innerHTML = `${selector} {color: ${text}; background-color: ${mark};`
    } else {
      this.styleElement.innerHTML = ''
    }
  }
}

// This is like a few lines so I don't want this as an external dependency.
// Not sure debounce necessary, but I would like to be as kind as I can to peoples devices. Like if you really pound your keyboard and the table is huge, maybe then this is needed.
function debounce (fn, delay) {
  let id;
  return function (...args) {
    if (id) clearTimeout(id)
    id = setTimeout(() => fn(...args), delay)
  }
}
