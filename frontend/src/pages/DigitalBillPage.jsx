import { useTripStore } from '../store/tripStore'
import BackHeader from '../components/BackHeader'

export default function DigitalBillPage({ onBack, onSplit }) {
  const { state } = useTripStore()
  const { bill, tx } = state.flow

  if (!bill) return null

  const merchant = bill.merchant || tx?.merchant || 'Receipt'
  const total = bill.total ?? Math.abs(tx?.amount ?? 0)

  return (
    <div className="flex flex-col min-h-svh" style={{ background: '#111111' }}>
      <BackHeader title={merchant} onBack={onBack} />

      <div className="flex-1 overflow-y-auto p-4 pb-28 flex flex-col gap-3">
        {/* Summary card */}
        <div
          className="rounded-2xl p-4"
          style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="font-bold text-white text-base">{merchant}</p>
            <p className="font-bold text-white text-lg">€{total.toFixed(2)}</p>
          </div>
          {bill.date && (
            <p className="text-xs" style={{ color: '#8e8e93' }}>{bill.date}</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span
              className="text-xs font-medium px-2.5 py-0.5 rounded-full"
              style={{ background: '#00d66920', color: '#00d669' }}
            >
              ✓ {bill.items?.length ?? 0} items extracted
            </span>
          </div>
        </div>

        {/* Items list */}
        {bill.items && bill.items.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#8e8e93' }}>
                Items
              </p>
            </div>
            {bill.items.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-3.5"
                style={{
                  borderBottom: idx < bill.items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{item.name}</p>
                  {item.quantity > 1 && (
                    <p className="text-xs" style={{ color: '#8e8e93' }}>×{item.quantity} @ €{item.price.toFixed(2)}</p>
                  )}
                </div>
                <p className="text-sm font-semibold text-white ml-4">
                  €{(item.price * (item.quantity ?? 1)).toFixed(2)}
                </p>
              </div>
            ))}
            {/* Total row */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#2c2c2e' }}
            >
              <p className="text-sm font-semibold text-white">Total</p>
              <p className="text-sm font-bold text-white">€{total.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Split button */}
      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto p-4"
        style={{
          background: '#111111',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <button
          onClick={onSplit}
          className="w-full py-4 rounded-2xl font-bold text-base"
          style={{ background: '#00d669', color: '#000' }}
        >
          Split this →
        </button>
      </div>
    </div>
  )
}
