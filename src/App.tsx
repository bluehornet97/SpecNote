import { useRef, useState } from 'react'
import elementTypes from './data/element-types.json'
import { createElement, createElementList, createItem, fromJson, toJson, validate } from './domain'
import type { ElementList, ElementType, SpecDocument, SpecItem } from './types'

type ItemUpdate = (item: SpecItem) => SpecItem

function updateItem(items: SpecItem[], id: string, update: ItemUpdate): SpecItem[] {
  return items.map((item) => item.id === id ? update(item) : { ...item, children: updateItem(item.children, id, update) })
}

function removeItem(items: SpecItem[], id: string): SpecItem[] {
  return items.filter((item) => item.id !== id).map((item) => ({ ...item, children: removeItem(item.children, id) }))
}

function findItem(items: SpecItem[], id: string): SpecItem | undefined {
  for (const item of items) {
    if (item.id === id) return item
    const found = findItem(item.children, id)
    if (found) return found
  }
}

function downloadJson(specDocument: SpecDocument, template: boolean) {
  const output = toJson(specDocument, template)
  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = template ? 'specnote-template.json' : 'specnote.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [document, setDocument] = useState<SpecDocument>({ items: [] })
  const [selectedId, setSelectedId] = useState<string>()
  const [errors, setErrors] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const selected = selectedId ? findItem(document.items, selectedId) : undefined

  const addItem = (parent?: SpecItem) => {
    const level = parent ? (parent.level + 1) as 2 | 3 : 1
    if (parent && parent.level === 3) return
    const item = createItem(level)
    setDocument((current) => parent ? { items: updateItem(current.items, parent.id, (target) => ({ ...target, children: [...target.children, item] })) } : { items: [...current.items, item] })
    setSelectedId(item.id)
    setNotice('項目を追加しました。')
  }

  const addList = (itemId: string) => {
    const list = createElementList()
    setDocument((current) => ({ items: updateItem(current.items, itemId, (item) => ({ ...item, elementLists: [...item.elementLists, list] })) }))
    setSelectedId(itemId)
  }

  const updateList = (itemId: string, listId: string, patch: Partial<ElementList>) => {
    setDocument((current) => ({ items: updateItem(current.items, itemId, (item) => ({ ...item, elementLists: item.elementLists.map((list) => list.id === listId ? { ...list, ...patch } : list) })) }))
  }

  const addElement = (itemId: string, listId: string) => {
    setDocument((current) => ({ items: updateItem(current.items, itemId, (item) => ({ ...item, elementLists: item.elementLists.map((list) => list.id === listId ? { ...list, elements: [...list.elements, createElement()] } : list) })) }))
  }

  const moveItem = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    const dragged = findItem(document.items, draggedId)
    const target = findItem(document.items, targetId)
    if (!dragged || !target || dragged.level !== target.level) return
    const without = removeItem(document.items, draggedId)
    const insert = (items: SpecItem[]): SpecItem[] => {
      const targetIndex = items.findIndex((item) => item.id === targetId)
      if (targetIndex >= 0) return [...items.slice(0, targetIndex), dragged, ...items.slice(targetIndex)]
      return items.map((item) => ({ ...item, children: insert(item.children) }))
    }
    setDocument({ items: insert(without) })
  }

  const exportDocument = (template: boolean) => {
    const validationErrors = validate(document)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      setNotice('入力内容を確認してください。')
      return
    }
    downloadJson(document, template)
    setErrors([])
    setNotice(template ? 'テンプレートJSONを書き出しました。' : '製品スペックJSONを書き出しました。')
  }

  const importDocument = async (file: File) => {
    try {
      const parsed = fromJson(JSON.parse(await file.text()))
      const validationErrors = validate(parsed)
      if (validationErrors.length > 0) throw new Error(validationErrors.join('\n'))
      setDocument(parsed)
      setSelectedId(undefined)
      setErrors([])
      setNotice(`${file.name}を読み込みました。`)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'JSONを読み込めませんでした。'])
      setNotice('読み込みに失敗しました。')
    }
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">S</span><div><strong>SpecNote</strong><span>product specification editor</span></div></div>
      <div className="toolbar">
        <button className="button secondary" onClick={() => fileInput.current?.click()}>↑ 読み込む</button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(event) => event.target.files?.[0] && importDocument(event.target.files[0])} />
        <button className="button secondary" onClick={() => exportDocument(true)}>テンプレート ↓</button>
        <button className="button primary" onClick={() => exportDocument(false)}>JSONを書き出す ↓</button>
      </div>
    </header>
    <main className="workspace">
      <section className="intro"><div><p className="eyebrow">SPECIFICATION WORKSPACE</p><h1>製品の仕様を、<em>使える構造</em>に。</h1><p className="lede">項目を組み立て、値を揃え、下流工程でそのまま使えるJSONへ。</p></div><div className="intro-stat"><strong>{document.items.length.toString().padStart(2, '0')}</strong><span>大項目</span></div></section>
      <div className="content-grid">
        <section className="tree-panel panel"><div className="panel-heading"><div><p className="eyebrow">STRUCTURE</p><h2>スペック構造</h2></div><button className="icon-button accent" title="大項目を追加" onClick={() => addItem()}>＋</button></div>
          {document.items.length === 0 ? <div className="empty-state"><div className="empty-icon">＋</div><strong>最初の項目を追加しましょう</strong><p>大項目から製品の構造を組み立てます。</p><button className="button primary" onClick={() => addItem()}>大項目を追加</button></div> : <div className="tree-list">{document.items.map((item, index) => <ItemNode key={item.id} item={item} index={index} selectedId={selectedId} onSelect={setSelectedId} onAddItem={addItem} onAddList={addList} onDelete={(id) => { setDocument((current) => ({ items: removeItem(current.items, id) })); if (selectedId === id) setSelectedId(undefined) }} onMove={moveItem} updateList={updateList} onAddElement={addElement} setDocument={setDocument} />)}</div>}
        </section>
        <aside className="detail-panel panel">{selected ? <Detail item={selected} onChange={(patch) => setDocument((current) => ({ items: updateItem(current.items, selected.id, (item) => ({ ...item, ...patch })) }))} /> : <div className="detail-empty"><span>◈</span><h2>項目を選択</h2><p>左の構造ツリーから項目を選ぶと、詳細を編集できます。</p></div>}</aside>
      </div>
      {notice && <div className="notice">{notice}</div>}
      {errors.length > 0 && <section className="errors"><strong>保存できません</strong>{errors.map((error) => <p key={error}>{error}</p>)}</section>}
    </main>
    <footer><span>SpecNote 0.1</span><span>ローカルで動作しています。データはブラウザ外へ送信されません。</span></footer>
  </div>
}

function ItemNode({ item, index, selectedId, onSelect, onAddItem, onAddList, onDelete, onMove, updateList, onAddElement, setDocument }: { item: SpecItem; index: number; selectedId?: string; onSelect: (id: string) => void; onAddItem: (item?: SpecItem) => void; onAddList: (id: string) => void; onDelete: (id: string) => void; onMove: (dragged: string, target: string) => void; updateList: (itemId: string, listId: string, patch: Partial<ElementList>) => void; onAddElement: (itemId: string, listId: string) => void; setDocument: React.Dispatch<React.SetStateAction<SpecDocument>> }) {
  const [dragging, setDragging] = useState(false)
  return <div className={`item-wrap level-${item.level}`}>
    <div className={`item-row ${selectedId === item.id ? 'selected' : ''} ${dragging ? 'dragging' : ''}`} draggable onDragStart={() => setDragging(true)} onDragEnd={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onMove(event.dataTransfer.getData('text/plain'), item.id)} onMouseDown={(event) => event.currentTarget.setAttribute('data-drag-id', item.id)} onDragStartCapture={(event) => event.dataTransfer.setData('text/plain', item.id)} onClick={() => onSelect(item.id)}>
      <span className="drag-handle">⠿</span><span className="level-tag">{['大', '中', '小'][item.level - 1]}</span><span className="item-name">{item.name || '名称未設定'}</span><span className="item-count">{item.elementLists.length ? `${item.elementLists.length} LIST` : item.children.length ? `${item.children.length} CHILD` : 'EMPTY'}</span>
      <div className="row-actions"><button title="子項目を追加" disabled={item.level === 3} onClick={(event) => { event.stopPropagation(); onAddItem(item) }}>＋</button><button title="要素リストを追加" onClick={(event) => { event.stopPropagation(); onAddList(item.id) }}>▤</button><button title="削除" className="danger" onClick={(event) => { event.stopPropagation(); onDelete(item.id) }}>−</button></div>
    </div>
    {item.elementLists.map((list) => <ElementListNode key={list.id} item={item} list={list} updateList={updateList} onAddElement={onAddElement} setDocument={setDocument} />)}
    {item.children.map((child, childIndex) => <ItemNode key={child.id} item={child} index={childIndex} selectedId={selectedId} onSelect={onSelect} onAddItem={onAddItem} onAddList={onAddList} onDelete={onDelete} onMove={onMove} updateList={updateList} onAddElement={onAddElement} setDocument={setDocument} />)}
  </div>
}

function ElementListNode({ item, list, updateList, onAddElement, setDocument }: { item: SpecItem; list: ElementList; updateList: (itemId: string, listId: string, patch: Partial<ElementList>) => void; onAddElement: (itemId: string, listId: string) => void; setDocument: React.Dispatch<React.SetStateAction<SpecDocument>> }) {
  return <div className="element-list"><div className="list-top"><span className="list-icon">↳</span><input value={list.label} placeholder="リストのラベル" onChange={(event) => updateList(item.id, list.id, { label: event.target.value })} /><span className="type-pill">{list.type}</span><button className="mini-delete" onClick={() => setDocument((current) => ({ items: updateItem(current.items, item.id, (target) => ({ ...target, elementLists: target.elementLists.filter((candidate) => candidate.id !== list.id) })) }))}>−</button></div><div className="list-settings"><select value={list.type} onChange={(event) => updateList(item.id, list.id, { type: event.target.value as ElementType })}>{elementTypes.map((type) => <option value={type.type} key={type.type}>{type.label}</option>)}</select><input value={list.unit} placeholder="単位（例: mm）" onChange={(event) => updateList(item.id, list.id, { unit: event.target.value })} />{list.type === 'number' && <input type="number" min="0" value={list.precision ?? 0} aria-label="小数桁数" onChange={(event) => updateList(item.id, list.id, { precision: Number(event.target.value) })} />}</div><div className="elements">{list.elements.map((element, index) => <div className="element-row" key={element.id}><span>{String(index + 1).padStart(2, '0')}</span><input value={element.value} inputMode={list.type === 'string' ? 'text' : 'decimal'} placeholder="値を入力" onChange={(event) => setDocument((current) => ({ items: updateItem(current.items, item.id, (target) => ({ ...target, elementLists: target.elementLists.map((candidate) => candidate.id === list.id ? { ...candidate, elements: candidate.elements.map((entry) => entry.id === element.id ? { ...entry, value: event.target.value } : entry) } : candidate) })) }))} /><button className="mini-delete" onClick={() => setDocument((current) => ({ items: updateItem(current.items, item.id, (target) => ({ ...target, elementLists: target.elementLists.map((candidate) => candidate.id === list.id ? { ...candidate, elements: candidate.elements.filter((entry) => entry.id !== element.id) } : candidate) })) }))}>×</button></div>)}<button className="add-element" onClick={() => onAddElement(item.id, list.id)}>＋ 要素を追加</button></div></div>
}

function Detail({ item, onChange }: { item: SpecItem; onChange: (patch: Partial<SpecItem>) => void }) {
  return <div className="detail-content"><p className="eyebrow">ITEM DETAIL / LEVEL {item.level}</p><h2>項目の詳細</h2><label className="field-label">項目名<input className="name-input" autoFocus value={item.name} placeholder="例: 接続端子" onChange={(event) => onChange({ name: event.target.value })} /></label><div className="detail-note"><span>i</span><p>同じ階層の項目名は重複できません。名前は保存時に検証されます。</p></div><div className="summary-grid"><div><span>子項目</span><strong>{item.children.length}</strong></div><div><span>要素リスト</span><strong>{item.elementLists.length}</strong></div></div></div>
}

export default App
