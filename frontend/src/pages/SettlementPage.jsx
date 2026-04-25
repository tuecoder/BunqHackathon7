import { useState } from 'react'
import { useTripStore, calculateBalances, computeSettlements } from '../store/tripStore'
import BackHeader from '../components/BackHeader'

export default function SettlementPage({ onBack, onDone }) {
  const { state, dispatch } = useTripStore()
  const { tx, method, config, targetMemberIds, paidByMemberId } = state.flow
  const allMembers = state.members
  const targetMembers = allMembers.filter(m => (targetMemberIds ?? []).includes(m.id))
  const total = Math.abs(tx?.amount ?? 0)

  const balances = calculateBalances({ ...config, paidByMemberId }, targetMembers, total, method)
  const transfers = computeSettlements(balances)

  const [statuses, setStatuses] = useState(() =>
    Object.fromEntries(transfers.map((_, i) => [i, 'pending']))
  )
  const [urls, setUrls] = useState({})
  const [sending, setSending] = useState(false)

  function getMember(id) { return allMembers.find(m => m.id === id) }

  async function sendAll() {
    setSending(true)
    const requests = []
    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i]
      setStatuses(prev => ({ ...prev, [i]: 'loading' }))
      try {
        const creditor = getMember(t.to)
        const debtor = getMember(t.from)
        const res = await fetch('/api/request-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creditor_member_id: t.to,
            debtor_member_id: t.from,
            amount: t.amount,
            description: `${tx?.merchant ?? 'Expense'} — ${debtor?.name} owes ${creditor?.name}`,
          }),
        })
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setStatuses(prev => ({ ...prev, [i]: 'sent' }))
        setUrls(prev => ({ ...prev, [i]: data.bunq_me_url }))
        requests.push({ to: t.to, toName: creditor?.name, amount: t.amount, bunqMeUrl: data.bunq_me_url })
      } catch {
        setStatuses(prev => ({ ...prev, [i]: 'error' }))
      }
    }
    dispatch({ type: 'UPDATE_FLOW', payload: { sentRequests: requests } })
    setSending(false)
  }

  function markAllSettled() {
    const requests = transfers.map(t => ({
      to: t.to, toName: getMember(t.to)?.name, amount: t.amount, bunqMeUrl: null,
    }))
    dispatch({ type: 'UPDATE_FLOW', payload: { sentRequests: requests } })
    onDone()
  }

  const allSent = transfers.length > 0 && transfers.every((_, i) => statuses[i] === 'sent')

  if (transfers.length === 0) {
    return (
      <div className="flex flex-col min-h-svh" style={{ background: '#111111' }}>
        <BackHeader title="Settlement" onBack={onBack} />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <p className="text-5xl mb-4">🎉</p>
          <p className="font-bold text-white text-xl mb-2">Everyone's even!</p>
          <p className="text-sm" style={{ color: '#8e8e93' }}>No transfers needed for this split.</p>
          <button
            onClick={onDone}
            className="mt-8 px-8 py-3.5 rounded-2xl font-semibold"
            style={{ background: '#00d669', color: '#000' }}
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-svh" style={{ background: '#111111' }}>
      <BackHeader title="Settlement plan" onBack={onBack} />

      <div className="flex-1 overflow-y-auto p-4 pb-36 flex flex-col gap-3">
        <p className="text-xs px-1" style={{ color: '#8e8e93' }}>
          {transfers.length} transfer{transfers.length > 1 ? 's' : ''} · €{total.toFixed(2)} total
        </p>

        {transfers.map((t, i) => {
          const from = getMember(t.from)
          const to = getMember(t.to)
          const status = statuses[i]
          const url = urls[i]

          return (
            <div
              key={i}
              className="rounded-2xl p-4"
              style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: from?.color }}
                >
                  {from?.name.slice(0, 2).toUpperCase()}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: to?.color }}
                >
                  {to?.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 ml-1">
                  <p className="text-sm font-medium text-white">{from?.name} → {to?.name}</p>
                  <p className="text-xs" style={{ color: '#8e8e93' }}>payment request</p>
                </div>
                <span className="font-bold text-white">€{t.amount.toFixed(2)}</span>
              </div>

              {status === 'loading' && (
                <div className="flex items-center gap-2 text-xs" style={{ color: '#8e8e93' }}>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeLinecap="round" opacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Sending via bunq...
                </div>
              )}

              {status === 'sent' && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#00d669' }}>✓ Request sent</p>
                  {url && (
                    <div
                      className="flex items-center gap-2 rounded-xl px-3 py-2"
                      style={{ background: '#00d66915', border: '1px solid #00d66930' }}
                    >
                      <a
                        href={url} target="_blank" rel="noopener noreferrer"
                        className="text-xs flex-1 underline truncate"
                        style={{ color: '#00d669' }}
                      >
                        {url}
                      </a>
                      <button
                        onClick={() => navigator.clipboard.writeText(url)}
                        className="text-xs font-medium whitespace-nowrap"
                        style={{ color: '#00d669' }}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              )}

              {status === 'error' && (
                <p className="text-xs" style={{ color: '#ff453a' }}>Failed to send — will be marked manual</p>
              )}
            </div>
          )
        })}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto p-4 flex flex-col gap-2"
        style={{
          background: '#111111',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        {!allSent && (
          <button
            onClick={sendAll}
            disabled={sending}
            className="w-full py-4 rounded-2xl font-bold text-base disabled:opacity-60"
            style={{ background: '#00d669', color: '#000' }}
          >
            {sending ? 'Sending...' : 'Send all bunq requests'}
          </button>
        )}
        {allSent && (
          <button
            onClick={onDone}
            className="w-full py-4 rounded-2xl font-bold text-base"
            style={{ background: '#00d669', color: '#000' }}
          >
            View confirmation →
          </button>
        )}
        {!allSent && (
          <button
            onClick={markAllSettled}
            className="w-full py-3 rounded-2xl font-medium text-sm"
            style={{ background: '#1c1c1e', color: '#8e8e93', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Mark as settled manually
          </button>
        )}
      </div>
    </div>
  )
}
