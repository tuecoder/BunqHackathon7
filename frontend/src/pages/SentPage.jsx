import { useState, useEffect } from 'react'
import { useTripStore } from '../store/tripStore'

export default function SentPage({ onDone }) {
  const { state } = useTripStore()
  const { sentRequests, tx, splitId } = state.flow

  const [splitData, setSplitData] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (splitId) fetchStatus()
  }, [splitId])

  async function fetchStatus() {
    if (!splitId) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/splits/${splitId}`)
      if (res.ok) setSplitData(await res.json())
    } catch {} finally {
      setRefreshing(false)
    }
  }

  // Use live backend data when available, otherwise fall back to local sentRequests
  const requests = splitData
    ? splitData.split.requests
    : (sentRequests ?? []).map(r => ({ ...r, to_name: r.toName, status: 'pending' }))

  const paid = splitData?.paid ?? 0
  const pending = splitData?.pending ?? requests.length

  return (
    <div className="flex flex-col min-h-svh" style={{ background: '#0a0a0a' }}>
      {/* Success header */}
      <div className="px-6 pt-16 pb-6 text-center">
        <div
          className="rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: '#00d66920', width: 72, height: 72 }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00d669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">All done!</h1>
        <p className="text-sm" style={{ color: '#8e8e93' }}>
          {tx?.merchant ? `Split for ${tx.merchant} complete` : 'Split complete'}
        </p>

        {/* Paid / pending summary pills */}
        {requests.length > 0 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: '#00d66920', color: '#00d669' }}
            >
              {paid} paid
            </span>
            {pending > 0 && (
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{ background: '#F59E0B20', color: '#F59E0B' }}
              >
                {pending} pending
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 px-4 pb-36 flex flex-col gap-3">
        {requests.length > 0 && (
          <>
            <div className="flex items-center justify-between px-1 mb-1">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#8e8e93' }}>
                Payment requests
              </p>
              {splitId && (
                <button
                  onClick={fetchStatus}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: '#00d669' }}
                >
                  <svg
                    className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  Refresh
                </button>
              )}
            </div>

            {requests.map((req, i) => {
              const isPaid = req.status === 'paid'
              const name = req.to_name ?? req.toName
              const url = req.bunq_me_url ?? req.bunqMeUrl

              return (
                <div
                  key={i}
                  className="rounded-2xl p-4"
                  style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {isPaid ? (
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: '#00d66920' }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00d669" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </span>
                      ) : (
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: '#F59E0B20' }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                          </svg>
                        </span>
                      )}
                      <p className="font-semibold text-white">{name}</p>
                    </div>
                    <p className="font-bold text-white">€{req.amount.toFixed(2)}</p>
                  </div>

                  {isPaid ? (
                    <p className="text-xs font-semibold" style={{ color: '#00d669' }}>✓ Payment received</p>
                  ) : url ? (
                    <div
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                      style={{ background: '#00d66915', border: '1px solid #00d66930' }}
                    >
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs flex-1 underline truncate"
                        style={{ color: '#00d669' }}
                      >
                        {url}
                      </a>
                      <button
                        onClick={() => navigator.clipboard.writeText(url)}
                        className="text-xs font-semibold whitespace-nowrap"
                        style={{ color: '#00d669' }}
                      >
                        Copy
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: '#8e8e93' }}>Waiting for payment</p>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto p-4"
        style={{
          background: '#0a0a0a',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <button
          onClick={onDone}
          className="w-full py-4 rounded-2xl font-bold text-base"
          style={{ background: '#00d669', color: '#000' }}
        >
          Back to home
        </button>
      </div>
    </div>
  )
}
