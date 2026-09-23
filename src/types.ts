export type ElementType = 'string' | 'integer' | 'number'
export type ItemLevel = 1 | 2 | 3

export interface SpecElement {
  id: string
  value: string
}

export interface ElementList {
  id: string
  label: string
  type: ElementType
  unit: string
  precision?: number
  elements: SpecElement[]
}

export interface SpecItem {
  id: string
  name: string
  level: ItemLevel
  children: SpecItem[]
  elementLists: ElementList[]
}

export interface SpecDocument {
  items: SpecItem[]
}

export interface JsonElement {
  value: string | number
}

export interface JsonElementList {
  label: string
  type: ElementType
  unit: string
  precision?: number
  elements: JsonElement[]
}

export interface JsonItem {
  name: string
  children: JsonItem[]
  elementLists: JsonElementList[]
}

export interface JsonDocument {
  items: JsonItem[]
}
