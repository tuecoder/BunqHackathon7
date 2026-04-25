import { useState, useEffect } from 'react'
import { useTripStore } from '../store/tripStore'
import TransactionItem from '../components/TransactionItem'
import GroupCard from '../components/GroupCard'

const EMOJI_OPTIONS = ['🏠', '✈️', '🍕', '🎿', '🎉', '🏖️', '🏋️', '🎸', '🌍', '👥']
const COLOR_OPTIONS = ['#5B6CF9', '#E85D24', '#1D9E75', '#F59E0B', '#EC4899', '#8B5CF6', '#0EA5E9']

function BottomNav({ activeTab, onTabChange }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto flex"
      style={{
        background: '#111111',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {[
        {
          id: 0, label: 'Transactions',
          icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#00d669' : '#8e8e93'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="3" />
              <path d="M2 10h20" />
            </svg>
          ),
        },
        {
          id: 1, label: 'Groups',
          icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#00d669' : '#8e8e93'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="7" r="4" />
              <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
              <circle cx="19" cy="7" r="3" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            </svg>
          ),
        },
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className="flex-1 flex flex-col items-center gap-1 py-3"
        >
          {tab.icon(activeTab === tab.id)}
          <span
            className="text-[11px] font-medium"
            style={{ color: activeTab === tab.id ? '#00d669' : '#8e8e93' }}
          >
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  )
}

export default function HomePage({ onTxSelect, onReset }) {
  const { state, dispatch } = useTripStore()
  const [tab, setTab] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [txLoading, setTxLoading] = useState(false)
  const [groups, setGroups] = useState([])
  const [myMember, setMyMember] = useState(null)
  const [balanceRefreshing, setBalanceRefreshing] = useState(false)
  const [setupNeeded, setSetupNeeded] = useState(false)

  // Create group form
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupEmoji, setNewGroupEmoji] = useState('👥')
  const [newGroupColor, setNewGroupColor] = useState('#5B6CF9')
  const [newGroupMemberIds, setNewGroupMemberIds] = useState([state.myMemberId ?? 'sp_0'])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    // Kick off all three in parallel — transactions use sp_0 immediately
    // rather than waiting for members to resolve first
    await Promise.all([loadMembers(), loadGroups(), loadTransactions('sp_0')])
  }

  async function loadMembers() {
    try {
      const res = await fetch('/api/sandbox-users')
      if (!res.ok) {
        if (res.status === 503) setSetupNeeded(true)
        return
      }
      setSetupNeeded(false)
      const data = await res.json()
      dispatch({ type: 'SET_MEMBERS', payload: data.members })
      const me = data.members.find(m => m.id === (state.myMemberId ?? 'sp_0'))
      setMyMember(me ?? data.members[0])
    } catch {
      setSetupNeeded(true)
    }
  }

  async function loadTransactions(memberId) {
    setTxLoading(true)
    try {
      const res = await fetch(`/api/transactions?member_id=${memberId}`)
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions)
      }
    } catch {} finally {
      setTxLoading(false)
    }
  }

  async function loadGroups() {
    try {
      const res = await fetch('/api/groups')
      if (res.ok) {
        const data = await res.json()
        setGroups(data.groups)
        dispatch({ type: 'SET_GROUPS', payload: data.groups })
      }
    } catch {}
  }

  async function refreshBalances() {
    setBalanceRefreshing(true)
    try {
      const res = await fetch('/api/sandbox-users')
      if (res.ok) {
        const data = await res.json()
        dispatch({ type: 'SET_MEMBERS', payload: data.members })
        const me = data.members.find(m => m.id === (state.myMemberId ?? 'sp_0'))
        setMyMember(me ?? data.members[0])
      }
    } catch {} finally {
      setBalanceRefreshing(false)
    }
  }

  function toggleNewMember(id) {
    const myId = state.myMemberId ?? 'sp_0'
    if (id === myId) return
    setNewGroupMemberIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function createGroup() {
    if (!newGroupName.trim() || newGroupMemberIds.length < 2) return
    setCreating(true)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          memberIds: newGroupMemberIds,
          color: newGroupColor,
          emoji: newGroupEmoji,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const updated = [...groups, data.group]
        setGroups(updated)
        dispatch({ type: 'SET_GROUPS', payload: updated })
        setShowCreateGroup(false)
        setNewGroupName('')
        setNewGroupMemberIds([state.myMemberId ?? 'sp_0'])
        setNewGroupEmoji('👥')
        setNewGroupColor('#5B6CF9')
      }
    } catch {} finally {
      setCreating(false)
    }
  }

  const me = myMember ?? state.members?.find(m => m.id === (state.myMemberId ?? 'sp_0'))

  return (
    <div className="flex flex-col min-h-svh" style={{ background: '#111111' }}>
      {/* Scrollable content — padded above bottom nav */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: '80px' }}>

        {/* Header */}
        <div style={{ background: '#0a0a0a' }} className="px-4 pt-12 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs" style={{ color: '#8e8e93' }}>Good day,</p>
              <h1 className="text-2xl font-bold text-white mt-0.5">{me?.name ?? 'Alice'}</h1>
            </div>
            <div className="flex items-center gap-3">
              {me?.balance && (
                <span
                  className="text-sm font-bold px-3 py-1.5 rounded-full"
                  style={{ background: '#00d669', color: '#000' }}
                >
                  €{parseFloat(me.balance || 0).toFixed(2)}
                </span>
              )}
              <button
                onClick={refreshBalances}
                disabled={balanceRefreshing}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: '#1c1c1e' }}
                title="Refresh"
              >
                <svg
                  className={`w-4 h-4 ${balanceRefreshing ? 'animate-spin' : ''}`}
                  style={{ color: '#8e8e93' }}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
              <button
                onClick={onReset}
                className="text-xs"
                style={{ color: '#3a3a3c' }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Transactions tab */}
        {tab === 0 && (
          <div className="p-4">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#8e8e93' }}>
              Recent transactions
            </p>
            {txLoading && (
              <div className="flex justify-center py-12">
                <div className="spinner" />
              </div>
            )}
            {!txLoading && transactions.length === 0 && (
              <div className="py-12 text-center">
                {setupNeeded ? (
                  <>
                    <p className="text-sm font-medium" style={{ color: '#ff453a' }}>
                      Sandbox not set up
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#3a3a3c' }}>
                      Run: cd backend && python setup_sandbox.py
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm" style={{ color: '#8e8e93' }}>No transactions yet</p>
                    <p className="text-xs mt-1" style={{ color: '#3a3a3c' }}>
                      Run add_demo_payments.py to add demo data
                    </p>
                  </>
                )}
              </div>
            )}
            {!txLoading && transactions.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#1c1c1e' }}>
                {transactions.map((tx, idx) => (
                  <TransactionItem
                    key={tx.id}
                    tx={tx}
                    onClick={() => onTxSelect(tx)}
                    isLast={idx === transactions.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Groups tab */}
        {tab === 1 && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#8e8e93' }}>
                Groups
              </p>
              <button
                onClick={() => setShowCreateGroup(v => !v)}
                className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-base"
                style={{ background: '#00d669', color: '#000' }}
              >
                {showCreateGroup ? '×' : '+'}
              </button>
            </div>

            {/* Create group form */}
            {showCreateGroup && (
              <div
                className="rounded-2xl p-4 mb-3"
                style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <p className="font-semibold text-sm text-white mb-3">New group</p>
                <input
                  type="text"
                  placeholder="Group name"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none"
                  style={{
                    background: '#2c2c2e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                  }}
                />
                {/* Emoji */}
                <p className="text-xs mb-1.5" style={{ color: '#8e8e93' }}>Emoji</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {EMOJI_OPTIONS.map(e => (
                    <button
                      key={e}
                      onClick={() => setNewGroupEmoji(e)}
                      className="w-9 h-9 rounded-xl text-lg flex items-center justify-center"
                      style={{
                        background: newGroupEmoji === e ? newGroupColor + '30' : '#2c2c2e',
                        border: `2px solid ${newGroupEmoji === e ? newGroupColor : 'transparent'}`,
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                {/* Color */}
                <p className="text-xs mb-1.5" style={{ color: '#8e8e93' }}>Color</p>
                <div className="flex gap-2 mb-3">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewGroupColor(c)}
                      className="w-7 h-7 rounded-full"
                      style={{
                        background: c,
                        outline: newGroupColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
                {/* Members */}
                <p className="text-xs mb-1.5" style={{ color: '#8e8e93' }}>Members</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {state.members.map(m => {
                    const selected = newGroupMemberIds.includes(m.id)
                    const isMe = m.id === (state.myMemberId ?? 'sp_0')
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleNewMember(m.id)}
                        disabled={isMe}
                        className="px-3 py-1.5 rounded-full text-xs font-medium"
                        style={selected
                          ? { background: m.color, color: '#fff', border: `2px solid ${m.color}` }
                          : { background: '#2c2c2e', color: '#8e8e93', border: '2px solid transparent' }}
                      >
                        {m.name}{isMe ? ' (you)' : ''}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={createGroup}
                  disabled={!newGroupName.trim() || newGroupMemberIds.length < 2 || creating}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: '#00d669', color: '#000' }}
                >
                  {creating ? 'Creating...' : 'Create group'}
                </button>
              </div>
            )}

            {groups.length === 0 && !showCreateGroup && (
              <div className="py-10 text-center">
                <p className="text-sm" style={{ color: '#8e8e93' }}>No groups yet — tap + to create one</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {groups.map(g => (
                <GroupCard key={g.id} group={g} />
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav activeTab={tab} onTabChange={setTab} />
    </div>
  )
}
