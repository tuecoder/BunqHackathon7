import { useState } from 'react'

export default function ItemRow({ item, editing, onChange }) {
  const [localName, setLocalName] = useState(item.name)
  const [localPrice, setLocalPrice] = useState(item.price)
  const [localQty, setLocalQty] = useState(item.quantity)

  function commit() {
    onChange({ ...item, name: localName, price: parseFloat(localPrice) || 0, quantity: parseInt(localQty) || 1 })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-0">
        <input
          value={localName}
          onChange={e => setLocalName(e.target.value)}
          onBlur={commit}
          className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm"
        />
        <input
          type="number"
          value={localQty}
          onChange={e => setLocalQty(e.target.value)}
          onBlur={commit}
          className="w-12 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
        />
        <span className="text-gray-400 text-sm">×</span>
        <input
          type="number"
          step="0.01"
          value={localPrice}
          onChange={e => setLocalPrice(e.target.value)}
          onBlur={commit}
          className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right"
        />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-800 flex-1">{item.name}</span>
      <span className="text-xs text-gray-400 mx-3">×{item.quantity}</span>
      <span className="text-sm font-medium text-gray-900">€{(item.price * item.quantity).toFixed(2)}</span>
    </div>
  )
}
