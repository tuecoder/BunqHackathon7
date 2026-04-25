import { createContext, useContext, useReducer, useEffect } from 'react'

const AppContext = createContext(null)

const initialFlow = {
  tx: null,              // { id, merchant, amount, date, description, type }
  bill: null,            // AI-extracted { merchant, total, items[] } or null
  targetGroupId: null,
  targetMemberIds: [],
  paidByMemberId: null,
  method: null,          // 'equal' | 'per_item'
  config: null,          // { includedMembers } or { itemAssignments: {itemId: [memberId]} }
  sentRequests: [],      // [{ to, toName, amount, bunqMeUrl }]
}

const initialState = {
  myMemberId: null,
  members: [],
  groups: [],
  flow: { ...initialFlow },
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_MY_MEMBER':
      return { ...state, myMemberId: action.payload }

    case 'SET_MEMBERS':
      return { ...state, members: action.payload }

    case 'SET_GROUPS':
      return { ...state, groups: action.payload }

    case 'START_FLOW':
      return {
        ...state,
        flow: {
          ...initialFlow,
          tx: action.payload.tx,
          paidByMemberId: state.myMemberId,
        },
      }

    case 'UPDATE_FLOW':
      return { ...state, flow: { ...state.flow, ...action.payload } }

    case 'RESET_FLOW':
      return { ...state, flow: { ...initialFlow } }

    case 'RESET':
      return { ...initialState }

    default:
      return state
  }
}

const STORAGE_KEY = 'bunq_splitter_v2'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...initialState, myMemberId: 'sp_0' }
    const saved = JSON.parse(raw)
    // Alice (sp_0) is always the default — persisted identity can override
    return {
      ...initialState,
      myMemberId: saved.myMemberId ?? 'sp_0',
    }
  } catch {
    return { ...initialState, myMemberId: 'sp_0' }
  }
}

export function TripProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadFromStorage)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ myMemberId: state.myMemberId }))
  }, [state.myMemberId])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useTripStore() {
  return useContext(AppContext)
}

// Pure balance calculation — used in SettlementPage
export function calculateBalances(config, members, total, method) {
  const balances = {}
  members.forEach(m => { balances[m.id] = 0 })

  if (method === 'equal') {
    const included = config?.includedMembers ?? members.map(m => m.id)
    const payer = config?.paidByMemberId
    if (included.length === 0 || !payer) return balances
    const share = total / included.length
    included.forEach(memberId => {
      if (memberId !== payer) {
        balances[payer] = (balances[payer] ?? 0) + share
        balances[memberId] = (balances[memberId] ?? 0) - share
      }
    })
  }

  if (method === 'per_item') {
    const payer = config?.paidByMemberId
    const assignments = config?.itemAssignments ?? {}
    const items = config?.items ?? []
    if (!payer) return balances
    items.forEach(item => {
      const assigned = assignments[item.id] ?? []
      if (assigned.length === 0) return
      const share = (item.price * (item.quantity ?? 1)) / assigned.length
      assigned.forEach(memberId => {
        if (memberId !== payer) {
          balances[payer] = (balances[payer] ?? 0) + share
          balances[memberId] = (balances[memberId] ?? 0) - share
        }
      })
    })
  }

  return balances
}

export function computeSettlements(balances) {
  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0.01)
    .sort((a, b) => b[1] - a[1])
    .map(([id, amt]) => [id, amt])

  const debtors = Object.entries(balances)
    .filter(([, v]) => v < -0.01)
    .sort((a, b) => a[1] - b[1])
    .map(([id, amt]) => [id, amt])

  const transfers = []
  let i = 0, j = 0

  while (i < creditors.length && j < debtors.length) {
    const [cId, cAmt] = creditors[i]
    const [dId, dAmt] = debtors[j]
    const amount = Math.min(cAmt, -dAmt)
    transfers.push({ from: dId, to: cId, amount: Math.round(amount * 100) / 100 })
    creditors[i][1] -= amount
    debtors[j][1] += amount
    if (creditors[i][1] < 0.01) i++
    if (debtors[j][1] > -0.01) j++
  }

  return transfers
}
