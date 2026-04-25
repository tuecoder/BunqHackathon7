export default function TransactionItem({ tx, onClick, isLast }) {
  const isDebit = tx.amount < 0
  const absAmount = Math.abs(tx.amount).toFixed(2)

  function merchantColor(name) {
    const colors = ['#5B6CF9', '#E85D24', '#1D9E75', '#F59E0B', '#EC4899', '#8B5CF6', '#0EA5E9']
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }

  const color = merchantColor(tx.merchant)

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      style={{
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <span
        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
        style={{ background: color }}
      >
        {tx.merchant.slice(0, 2).toUpperCase()}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white text-sm truncate">{tx.merchant}</p>
        <p className="text-xs" style={{ color: '#8e8e93' }}>{tx.date}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p
          className="font-semibold text-sm"
          style={{ color: isDebit ? '#ff453a' : '#32d74b' }}
        >
          {isDebit ? '−' : '+'}€{absAmount}
        </p>
        <p className="text-xs" style={{ color: '#3a3a3c' }}>Split</p>
      </div>
    </button>
  )
}
