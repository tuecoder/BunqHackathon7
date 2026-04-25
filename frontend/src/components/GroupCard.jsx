export default function GroupCard({ group, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl p-3.5 text-left"
      style={{
        background: '#1c1c1e',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <span
        className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: group.color + '25' }}
      >
        {group.emoji}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white text-sm">{group.name}</p>
        <p className="text-xs" style={{ color: '#8e8e93' }}>
          {group.members?.length ?? group.memberIds?.length ?? 0} members
        </p>
      </div>
      {/* Member avatar strip */}
      <div className="flex -space-x-1.5 flex-shrink-0">
        {(group.members ?? []).slice(0, 4).map(m => (
          <span
            key={m.id}
            className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-white text-xs font-bold"
            style={{ background: m.color, borderColor: '#1c1c1e' }}
            title={m.name}
          >
            {m.name.slice(0, 1)}
          </span>
        ))}
        {(group.members?.length ?? 0) > 4 && (
          <span
            className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold"
            style={{ background: '#2c2c2e', borderColor: '#1c1c1e', color: '#8e8e93' }}
          >
            +{(group.members?.length ?? 0) - 4}
          </span>
        )}
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3a3a3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}
