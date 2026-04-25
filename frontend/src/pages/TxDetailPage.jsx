import { useTripStore } from '../store/tripStore'
import BackHeader from '../components/BackHeader'

function merchantColor(name) {
  const colors = ['#5B6CF9', '#E85D24', '#1D9E75', '#F59E0B', '#EC4899', '#8B5CF6']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function TxDetailPage({ onBack, onAddReceipt, onSplit }) {
  const { state, dispatch } = useTripStore()
  const { tx, bill } = state.flow

  if (!tx) return null

  const isDebit = tx.amount < 0
  const absAmount = Math.abs(tx.amount).toFixed(2)
  const color = merchantColor(tx.merchant)
  const hasReceipt = !!bill

  function handleSplit() {
    dispatch({ type: 'UPDATE_FLOW', payload: { paidByMemberId: state.myMemberId ?? 'sp_0' } })
    onSplit()
  }

  return (
    <div className="flex flex-col min-h-svh" style={{ background: '#111111' }}>
      <BackHeader title={tx.merchant} onBack={onBack} />

      {/* Transaction hero */}
      <div
        className="flex flex-col items-center py-8 px-4"
        style={{ background: '#0a0a0a' }}
      >
        <span
          className="w-16 h-16 rounded-3xl flex items-center justify-center text-white font-bold text-xl mb-4"
          style={{ background: color }}
        >
          {tx.merchant.slice(0, 2).toUpperCase()}
        </span>
        <p
          className="text-3xl font-bold"
          style={{ color: isDebit ? '#ff453a' : '#32d74b' }}
        >
          {isDebit ? '−' : '+'}€{absAmount}
        </p>
        <p className="text-sm mt-1.5" style={{ color: '#8e8e93' }}>{tx.date}</p>
        <span
          className="mt-2 text-xs font-medium px-2.5 py-0.5 rounded-full"
          style={{ background: '#1c1c1e', color: '#8e8e93' }}
        >
          {isDebit ? 'Outgoing' : 'Incoming'}
        </span>
        {tx.description && tx.description !== tx.merchant && (
          <p className="text-xs mt-2 text-center" style={{ color: '#8e8e93' }}>
            {tx.description}
          </p>
        )}
      </div>

      <div className="flex-1 p-4 flex flex-col gap-3">
        {/* Receipt status card */}
        <div
          className="rounded-2xl p-4"
          style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold text-sm text-white">Receipt</p>
            {hasReceipt && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: '#00d66920', color: '#00d669' }}
              >
                ✓ {bill.items?.length ?? 0} items scanned
              </span>
            )}
          </div>
          <p className="text-xs mb-3" style={{ color: '#8e8e93' }}>
            {hasReceipt
              ? 'Items extracted — split by item for precision'
              : 'Add a receipt photo to enable item-level splitting'}
          </p>
          <button
            onClick={onAddReceipt}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: '#2c2c2e',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            {hasReceipt ? 'Re-scan receipt' : 'Add receipt photo'}
          </button>
        </div>

        {/* Quick preview of extracted items if receipt exists */}
        {hasReceipt && bill.items && bill.items.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#8e8e93' }}>
                Extracted items
              </p>
            </div>
            {bill.items.slice(0, 4).map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: idx < Math.min(3, bill.items.length - 1) ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              >
                <p className="text-sm text-white truncate flex-1">{item.name}</p>
                <p className="text-sm ml-3" style={{ color: '#8e8e93' }}>
                  €{(item.price * (item.quantity ?? 1)).toFixed(2)}
                </p>
              </div>
            ))}
            {bill.items.length > 4 && (
              <p className="text-xs px-4 py-2.5" style={{ color: '#8e8e93', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                +{bill.items.length - 4} more items
              </p>
            )}
          </div>
        )}
      </div>

      {/* Split button */}
      <div
        className="p-4"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: '#111111',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <button
          onClick={handleSplit}
          className="w-full py-4 rounded-2xl font-bold text-base"
          style={{ background: '#00d669', color: '#000' }}
        >
          Split this →
        </button>
      </div>
    </div>
  )
}
