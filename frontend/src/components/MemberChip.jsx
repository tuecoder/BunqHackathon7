export default function MemberChip({ member, selected, onClick, onRemove, size = 'md' }) {
  const sizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  }

  const initials = member.name.slice(0, 2).toUpperCase()

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full cursor-pointer select-none
        ${onClick ? 'hover:opacity-80 active:scale-95 transition-transform' : ''}
        ${selected !== undefined
          ? selected
            ? 'ring-2 ring-offset-1 opacity-100'
            : 'opacity-40'
          : 'opacity-100'
        }`}
      style={selected !== undefined ? { '--tw-ring-color': member.color } : {}}
      onClick={onClick}
    >
      <span
        className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}
        style={{ background: member.color }}
      >
        {initials}
      </span>
      {size !== 'sm' && (
        <span className="text-sm font-medium text-gray-700 pr-1">{member.name}</span>
      )}
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(member.id) }}
          className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 hover:bg-red-100 hover:text-red-600 text-xs leading-none"
        >
          ×
        </button>
      )}
    </div>
  )
}
