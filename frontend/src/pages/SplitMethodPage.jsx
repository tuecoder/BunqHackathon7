import { useTripStore } from '../store/tripStore'
import BackHeader from '../components/BackHeader'

export default function SplitMethodPage({ onBack, onNext }) {
  const { state, dispatch } = useTripStore()
  const { tx, bill, targetMemberIds } = state.flow
  const memberCount = targetMemberIds?.length ?? 2
  const total = Math.abs(tx?.amount ?? 0)
  const perPerson = memberCount > 0 ? (total / memberCount).toFixed(2) : '0.00'
  const hasItems = bill?.items?.length > 0

  function choose(method) {
    dispatch({ type: 'UPDATE_FLOW', payload: { method } })
    onNext()
  }

  return (
    <div className="flex flex-col min-h-svh" style={{ background: '#111111' }}>
      <BackHeader title="How to split?" onBack={onBack} />

      <div className="flex-1 p-4 flex flex-col gap-3">
        <p className="text-sm px-1 mb-1" style={{ color: '#8e8e93' }}>
          {memberCount} people · €{total.toFixed(2)} total
        </p>

        {/* Equal split */}
        <button
          onClick={() => choose('equal')}
          className="rounded-2xl p-4 text-left flex items-start gap-3"
          style={{ background: '#1c1c1e', border: '2px solid transparent' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#00d669'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
        >
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: '#00d66920' }}
          >
            ⚖️
          </span>
          <div className="flex-1">
            <p className="font-semibold text-white">Split equally</p>
            <p className="text-sm mt-0.5" style={{ color: '#8e8e93' }}>
              Everyone pays €{perPerson}
            </p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-1 flex-shrink-0">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* By item */}
        <button
          onClick={() => hasItems && choose('per_item')}
          disabled={!hasItems}
          className="rounded-2xl p-4 text-left flex items-start gap-3 disabled:opacity-40"
          style={{ background: '#1c1c1e', border: '2px solid transparent', cursor: hasItems ? 'pointer' : 'not-allowed' }}
        >
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: '#5B6CF920' }}
          >
            🧾
          </span>
          <div className="flex-1">
            <p className="font-semibold text-white">Split by item</p>
            <p className="text-sm mt-0.5" style={{ color: '#8e8e93' }}>
              {hasItems
                ? `Assign each of the ${bill.items.length} items to specific people`
                : 'Add a receipt first to enable item-level splitting'}
            </p>
          </div>
          {hasItems && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-1 flex-shrink-0">
              <path d="M9 18l6-6-6-6" />
            </svg>
          )}
        </button>

        {!hasItems && (
          <p className="text-xs text-center mt-1" style={{ color: '#3a3a3c' }}>
            Go back → Add receipt → scan to unlock item splitting
          </p>
        )}
      </div>
    </div>
  )
}
