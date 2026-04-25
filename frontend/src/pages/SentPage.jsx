import { useTripStore } from '../store/tripStore'

export default function SentPage({ onDone }) {
  const { state } = useTripStore()
  const { sentRequests, tx } = state.flow

  return (
    <div className="flex flex-col min-h-svh" style={{ background: '#0a0a0a' }}>
      {/* Success header */}
      <div className="px-6 pt-16 pb-8 text-center">
        <div
          className="w-18 h-18 rounded-full flex items-center justify-center mx-auto mb-5"
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
      </div>

      <div className="flex-1 px-4 pb-28 flex flex-col gap-3">
        {sentRequests && sentRequests.length > 0 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-widest px-1" style={{ color: '#8e8e93' }}>
              Payment requests sent
            </p>
            {sentRequests.map((req, i) => (
              <div
                key={i}
                className="rounded-2xl p-4"
                style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-white">{req.toName}</p>
                  <p className="font-bold text-white">€{req.amount.toFixed(2)}</p>
                </div>
                {req.bunqMeUrl ? (
                  <div
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                    style={{ background: '#00d66915', border: '1px solid #00d66930' }}
                  >
                    <a
                      href={req.bunqMeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs flex-1 underline truncate"
                      style={{ color: '#00d669' }}
                    >
                      {req.bunqMeUrl}
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(req.bunqMeUrl)}
                      className="text-xs font-semibold whitespace-nowrap"
                      style={{ color: '#00d669' }}
                    >
                      Copy
                    </button>
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: '#8e8e93' }}>Settled manually</p>
                )}
              </div>
            ))}
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
