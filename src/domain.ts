import type { ElementList, ElementType, JsonDocument, JsonElementList, JsonItem, SpecDocument, SpecItem } from './types'

export const createId = () => crypto.randomUUID()

export function createItem(level: 1 | 2 | 3): SpecItem {
  return { id: createId(), name: '', level, children: [], elementLists: [] }
}

export function createElementList(): ElementList {
  return { id: createId(), label: '', type: 'string', unit: '', elements: [] }
}

export function createElement(): { id: string; value: string } {
  return { id: createId(), value: '' }
}

export function toJson(document: SpecDocument, template = false): JsonDocument {
  const convertList = (list: ElementList): JsonElementList => ({
    label: list.label,
    type: list.type,
    unit: list.unit,
    ...(list.type === 'number' ? { precision: list.precision ?? 0 } : {}),
    elements: template ? [] : list.elements.map((element) => ({
      value: list.type === 'string' ? element.value : Number(element.value),
    })),
  })
  const convertItem = (item: SpecItem): JsonItem => ({
    name: item.name,
    children: item.children.map(convertItem),
    elementLists: item.elementLists.map(convertList),
  })
  return { items: document.items.map(convertItem) }
}

export function fromJson(input: unknown): SpecDocument {
  const document = input as JsonDocument
  if (!document || typeof document !== 'object' || !Array.isArray(document.items)) {
    throw new Error('Rootのitems配列がありません。')
  }
  const parseList = (list: JsonElementList): ElementList => {
    if (!list || typeof list !== 'object' || !Array.isArray(list.elements)) throw new Error('要素リストの形式が不正です。')
    if (!['string', 'integer', 'number'].includes(list.type)) throw new Error('未対応の要素型です。')
    return {
      id: createId(), label: String(list.label ?? ''), type: list.type as ElementType, unit: String(list.unit ?? ''),
      ...(list.type === 'number' ? { precision: Number(list.precision ?? 0) } : {}),
      elements: list.elements.map((element) => ({ id: createId(), value: String(element.value ?? '') })),
    }
  }
  const parseItem = (item: JsonItem, level: 1 | 2 | 3): SpecItem => {
    if (!item || typeof item !== 'object' || !Array.isArray(item.children) || !Array.isArray(item.elementLists)) throw new Error('項目の形式が不正です。')
    return { id: createId(), name: String(item.name ?? ''), level, elementLists: item.elementLists.map(parseList), children: level < 3 ? item.children.map((child) => parseItem(child, (level + 1) as 2 | 3)) : [] }
  }
  return { items: document.items.map((item) => parseItem(item, 1)) }
}

function validateItem(item: SpecItem, errors: string[], path: string, siblings: SpecItem[]): void {
  if (!item.name.trim()) errors.push(`${path}: 項目名を入力してください。`)
  if (siblings.filter((sibling) => sibling.id !== item.id && sibling.name.trim() === item.name.trim()).length > 0) errors.push(`${path}: 同じ階層に同名の項目があります。`)
  if (item.level < 3 && item.children.length > 0 && item.elementLists.length > 0) errors.push(`${path}: 子項目と要素リストはどちらか一方だけ設定できます。`)
  if (item.level === 3 && item.children.length > 0) errors.push(`${path}: 小項目に子項目は設定できません。`)
  item.elementLists.forEach((list, index) => {
    const listPath = `${path} / 要素リスト${index + 1}`
    if (list.type === 'number' && (!Number.isInteger(list.precision) || (list.precision ?? -1) < 0)) errors.push(`${listPath}: 小数桁数が不正です。`)
    list.elements.forEach((element, elementIndex) => {
      if (list.type === 'integer' && !/^-?\d+$/.test(element.value.trim())) errors.push(`${listPath} / 要素${elementIndex + 1}: 整数を入力してください。`)
      if (list.type === 'number' && !/^-?(?:\d+\.?\d*|\.\d+)$/.test(element.value.trim())) errors.push(`${listPath} / 要素${elementIndex + 1}: 実数を入力してください。`)
      if (list.type === 'number' && (element.value.split('.')[1]?.length ?? 0) > (list.precision ?? 0)) errors.push(`${listPath} / 要素${elementIndex + 1}: 小数点以下${list.precision ?? 0}桁以内で入力してください。`)
    })
  })
  item.children.forEach((child) => validateItem(child, errors, `${path} / ${child.name || '名称未設定'}`, item.children))
}

export function validate(document: SpecDocument): string[] {
  const errors: string[] = []
  document.items.forEach((item) => validateItem(item, errors, item.name || '大項目', document.items))
  return errors
}
