import { useState, useEffect } from 'react'
import { useTripStore } from '../store/tripStore'
import BackHeader from '../components/BackHeader'

export default function SplitConfigPage({ onBack, onNext }) {
  const { state, dispatch } = useTripStore()
  const { tx, bill, method, targetMemberIds, paidByMemberId, targetGroupId } = state.flow
  const allMembers = state.members
  const total = Math.abs(tx?.amount ?? 0)

  const [includedIds, setIncludedIds] = useState(targetMemberIds ?? [])
  const [itemAssignments, setItemAssignments] = useState(() => {
    const init = {}
    if (bill?.items) {
      bill.items.forEach(item => { init[item.id] = [] })
    }
    return init
  })
  const [suggestions, setSuggestions] = useState({})
  const [suggestedItemIds, setSuggestedItemIds] = useState(new Set())

  useEffect(() => {
    if (method !== 'per_item' || !targetGroupId || !bill?.items?.length) return
    fetch('/api/suggest-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: targetGroupId, bill_items: bill.items }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.has_history) return
        setSuggestions(data.suggestions)
        const updates = {}
        const autoIds = new Set()
        for (const item of bill.items) {
          const sug = data.suggestions[item.name]
          if (sug && sug.confidence === 'high') {
            updates[item.id] = sug.suggested_to
            autoIds.add(item.id)
          }
        }
        if (Object.keys(updates).length > 0) {
          setItemAssignments(prev => ({ ...prev, ...updates }))
          setSuggestedItemIds(autoIds)
        }
      })
      .catch(() => {})
  }, [])

  const targetMembers = allMembers.filter(m => (targetMemberIds ?? []).includes(m.id))

  function toggleIncluded(id) {
    setIncludedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleItemMember(itemId, memberId) {
    setItemAssignments(prev => {
      const current = prev[itemId] ?? []
      return {
        ...prev,
        [itemId]: current.includes(memberId) ? current.filter(x => x !== memberId) : [...current, memberId],
      }
    })
  }

  function continueEqual() {
    dispatch({ type: 'UPDATE_FLOW', payload: { config: { includedMembers: includedIds, paidByMemberId } } })
    onNext()
  }

  function continuePerItem() {
    dispatch({ type: 'UPDATE_FLOW', payload: { config: { itemAssignments, items: bill?.items ?? [], paidByMemberId } } })
    onNext()
  }

  function computeItemTotals() {
    const totals = {}
    targetMembers.forEach(m => { totals[m.id] = 0 })
    if (!bill?.items) return totals
    bill.items.forEach(item => {
      const assigned = itemAssignments[item.id] ?? []
      if (assigned.length === 0) return
      const share = (item.price * (item.quantity ?? 1)) / assigned.length
      assigned.forEach(id => { totals[id] = (totals[id] ?? 0) + share })
    })
    return totals
  }

  const cardStyle = { background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)' }

  if (method === 'equal') {
    const perPerson = includedIds.length > 0 ? total / includedIds.length : 0

    return (
      <div className="flex flex-col min-h-svh" style={{ background: '#111111' }}>
        <BackHeader title="Equal split" onBack={onBack} />
        <div className="flex-1 p-4 pb-28 flex flex-col gap-4">
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            {targetMembers.map((m, idx) => {
              const included = includedIds.includes(m.id)
              const isMe = m.id === (state.myMemberId ?? 'sp_0')
              return (
                <button
                  key={m.id}
                  onClick={() => !isMe && toggleIncluded(m.id)}
                  disabled={isMe}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left disabled:cursor-default"
                  style={{
                    borderBottom: idx < targetMembers.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: included ? m.color + '12' : 'transparent',
                  }}
                >
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: m.color, opacity: included ? 1 : 0.35 }}
                  >
                    {m.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{m.name}{isMe ? ' (you)' : ''}</p>
                    {included
                      ? <p className="text-xs font-semibold" style={{ color: '#00d669' }}>pays €{perPerson.toFixed(2)}</p>
                      : <p className="text-xs" style={{ color: '#8e8e93' }}>excluded</p>}
                  </div>
                  {!isMe && (
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={included
                        ? { background: m.color, border: `2px solid ${m.color}` }
                        : { border: '2px solid rgba(255,255,255,0.2)' }}
                    >
                      {included && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="rounded-2xl px-4 py-3 text-center" style={{ background: '#00d66915', border: '1px solid #00d66930' }}>
            <p className="text-sm font-medium" style={{ color: '#00d669' }}>
              {includedIds.length} people · <span className="font-bold">€{perPerson.toFixed(2)} each</span>
            </p>
          </div>
        </div>

        <div
          className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto p-4"
          style={{
            background: '#111111',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          }}
        >
          <button
            onClick={continueEqual}
            disabled={includedIds.length < 2}
            className="w-full py-4 rounded-2xl font-bold text-base disabled:opacity-30"
            style={{ background: '#00d669', color: '#000' }}
          >
            Continue →
          </button>
        </div>
      </div>
    )
  }

  // Per-item mode
  const itemTotals = computeItemTotals()
  const items = bill?.items ?? []
  const unassignedCount = items.filter(item => (itemAssignments[item.id] ?? []).length === 0).length

  return (
    <div className="flex flex-col min-h-svh" style={{ background: '#111111' }}>
      <BackHeader title="Assign items" onBack={onBack} />

      <div className="flex-1 overflow-y-auto p-4 pb-36 flex flex-col gap-3">
        {items.map(item => {
          const assigned = itemAssignments[item.id] ?? []
          const itemTotal = item.price * (item.quantity ?? 1)
          const sug = suggestions[item.name]
          const isAutoFilled = suggestedItemIds.has(item.id)
          return (
            <div key={item.id} className="rounded-2xl p-4" style={cardStyle}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                  {sug && (
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: '#00d66920', color: '#00d669', border: '1px solid #00d66940' }}
                      title={sug.reasoning}
                    >
                      ✦ AI
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-white ml-2">€{itemTotal.toFixed(2)}</p>
              </div>
              {item.quantity > 1 && (
                <p className="text-xs mb-2" style={{ color: '#8e8e93' }}>×{item.quantity} @ €{item.price.toFixed(2)}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {targetMembers.map(m => {
                  const sel = assigned.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleItemMember(item.id, m.id)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium"
                      style={sel
                        ? { background: m.color, color: '#fff', border: `2px solid ${m.color}` }
                        : { background: '#2c2c2e', color: '#8e8e93', border: '2px solid transparent' }}
                    >
                      {m.name.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
              {assigned.length > 0 && (
                <p className="text-xs mt-2" style={{ color: '#8e8e93' }}>
                  €{(itemTotal / assigned.length).toFixed(2)} each
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Sticky footer */}
      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto p-4"
        style={{
          background: '#111111',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex gap-3 overflow-x-auto pb-2 mb-3">
          {targetMembers.map(m => (
            <div key={m.id} className="flex flex-col items-center flex-shrink-0">
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold mb-0.5"
                style={{ background: m.color }}
              >
                {m.name.slice(0, 1)}
              </span>
              <span className="text-xs font-semibold text-white">
                €{(itemTotals[m.id] ?? 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        {unassignedCount > 0 && (
          <p className="text-xs text-center mb-2" style={{ color: '#ff453a' }}>
            {unassignedCount} item(s) not yet assigned
          </p>
        )}
        <button
          onClick={continuePerItem}
          className="w-full py-3.5 rounded-2xl font-bold text-base"
          style={{ background: '#00d669', color: '#000' }}
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
