import { useState } from 'react'
import { useTripStore } from '../store/tripStore'
import BackHeader from '../components/BackHeader'
import GroupCard from '../components/GroupCard'

export default function SplitTargetPage({ onBack, onNext }) {
  const { state, dispatch } = useTripStore()
  const [selectedContactIds, setSelectedContactIds] = useState([state.myMemberId ?? 'sp_0'])

  const groups = state.groups
  const allMembers = state.members
  const myId = state.myMemberId ?? 'sp_0'
  const contacts = allMembers.filter(m => m.id !== myId)

  function selectGroup(group) {
    dispatch({
      type: 'UPDATE_FLOW',
      payload: {
        targetGroupId: group.id,
        targetMemberIds: group.members?.map(m => m.id) ?? group.memberIds ?? [],
      },
    })
    onNext()
  }

  function toggleContact(id) {
    setSelectedContactIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function continueWithContacts() {
    const ids = [...new Set([myId, ...selectedContactIds].filter(Boolean))]
    dispatch({ type: 'UPDATE_FLOW', payload: { targetGroupId: null, targetMemberIds: ids } })
    onNext()
  }

  const canContinue = selectedContactIds.filter(id => id !== myId).length >= 1
  const me = allMembers.find(m => m.id === myId)

  return (
    <div className="flex flex-col min-h-svh" style={{ background: '#111111' }}>
      <BackHeader title="Split with" onBack={onBack} />

      <div className="flex-1 overflow-y-auto p-4 pb-28 flex flex-col gap-5">
        {/* Groups */}
        {groups.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#8e8e93' }}>
              Groups
            </p>
            <div className="flex flex-col gap-2">
              {groups.map(g => (
                <GroupCard key={g.id} group={g} onClick={() => selectGroup(g)} />
              ))}
            </div>
          </div>
        )}

        {/* Contacts */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#8e8e93' }}>
            Contacts
          </p>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {/* Me — always included */}
            {me && (
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: 0.5 }}
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: me.color }}
                >
                  {me.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{me.name} (you)</p>
                  <p className="text-xs truncate" style={{ color: '#8e8e93' }}>{me.bunqAlias}</p>
                </div>
                <span className="text-xs" style={{ color: '#8e8e93' }}>always</span>
              </div>
            )}
            {contacts.map((m, idx) => {
              const selected = selectedContactIds.includes(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => toggleContact(m.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  style={{
                    borderBottom: idx < contacts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: selected ? m.color + '12' : 'transparent',
                  }}
                >
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: m.color }}
                  >
                    {m.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{m.name}</p>
                    <p className="text-xs truncate" style={{ color: '#8e8e93' }}>{m.bunqAlias}</p>
                  </div>
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={selected
                      ? { background: m.color, border: `2px solid ${m.color}` }
                      : { border: '2px solid rgba(255,255,255,0.2)' }}
                  >
                    {selected && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto p-4"
        style={{
          background: '#111111',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <button
          onClick={continueWithContacts}
          disabled={!canContinue}
          className="w-full py-4 rounded-2xl font-bold text-base disabled:opacity-30"
          style={{ background: '#00d669', color: '#000' }}
        >
          Continue with selected →
        </button>
      </div>
    </div>
  )
}
