export default function BackHeader({ title, onBack, right }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10"
      style={{ background: '#111111', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      {onBack && (
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ background: '#1c1c1e' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      <span className="flex-1 font-semibold text-white text-base truncate">{title}</span>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  )
}
