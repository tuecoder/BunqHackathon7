import { describe, it, expect } from 'vitest'
import { calculateBalances, computeSettlements } from '../store/tripStore'

const members = [
  { id: 'm1', name: 'Prakash' },
  { id: 'm2', name: 'Sara' },
  { id: 'm3', name: 'Alex' },
]

describe('calculateBalances', () => {
  it('equal split: payer gets back correct amount', () => {
    const bills = [{
      id: 'b1', total: 30, paidBy: 'm1', splitMethod: 'equal',
      items: [],
      splitConfig: { includedMembers: ['m1', 'm2', 'm3'], itemAssignments: {} },
    }]
    const bal = calculateBalances(bills, members)
    expect(bal['m1']).toBeCloseTo(20)   // paid 30, share is 10, gets back 20
    expect(bal['m2']).toBeCloseTo(-10)
    expect(bal['m3']).toBeCloseTo(-10)
  })

  it('equal split: payer not double-charged for own share', () => {
    const bills = [{
      id: 'b1', total: 20, paidBy: 'm2', splitMethod: 'equal',
      items: [],
      splitConfig: { includedMembers: ['m1', 'm2'], itemAssignments: {} },
    }]
    const bal = calculateBalances(bills, members)
    expect(bal['m2']).toBeCloseTo(10)
    expect(bal['m1']).toBeCloseTo(-10)
    expect(bal['m3']).toBe(0)
  })

  it('per_item split: mixed assignments', () => {
    const bills = [{
      id: 'b1', total: 20, paidBy: 'm1', splitMethod: 'per_item',
      items: [
        { id: 'item_1', price: 10, quantity: 1 },  // m1 + m2
        { id: 'item_2', price: 10, quantity: 1 },  // m2 + m3
      ],
      splitConfig: {
        includedMembers: [],
        itemAssignments: {
          item_1: ['m1', 'm2'],
          item_2: ['m2', 'm3'],
        },
      },
    }]
    const bal = calculateBalances(bills, members)
    // item_1: m2 owes m1 5. item_2: m2 and m3 don't owe m1 (m1 is payer, m3 consumed item_2 not paid by m1... wait)
    // paidBy is m1. item_1: assigned [m1, m2]. share=5 each. m2 != m1 → m1 gets +5, m2 gets -5.
    // item_2: assigned [m2, m3]. share=5 each. m2 != m1 → m1 gets +5, m2 gets -5. m3 != m1 → m1 gets +5, m3 gets -5.
    expect(bal['m1']).toBeCloseTo(15)
    expect(bal['m2']).toBeCloseTo(-10)
    expect(bal['m3']).toBeCloseTo(-5)
  })

  it('per_item: empty assignment skipped', () => {
    const bills = [{
      id: 'b1', total: 10, paidBy: 'm1', splitMethod: 'per_item',
      items: [{ id: 'item_1', price: 10, quantity: 1 }],
      splitConfig: { includedMembers: [], itemAssignments: { item_1: [] } },
    }]
    const bal = calculateBalances(bills, members)
    expect(bal['m1']).toBe(0)
    expect(bal['m2']).toBe(0)
  })
})

describe('computeSettlements', () => {
  it('two debtors one creditor generates correct transfers', () => {
    const balances = { m1: 20, m2: -12, m3: -8 }
    const transfers = computeSettlements(balances)
    expect(transfers).toHaveLength(2)
    const total = transfers.reduce((s, t) => s + t.amount, 0)
    expect(total).toBeCloseTo(20)
    transfers.forEach(t => expect(t.to).toBe('m1'))
  })

  it('zero-balance member not included', () => {
    const balances = { m1: 10, m2: -10, m3: 0 }
    const transfers = computeSettlements(balances)
    expect(transfers).toHaveLength(1)
    expect(transfers[0].from).toBe('m2')
    expect(transfers[0].to).toBe('m1')
    expect(transfers[0].amount).toBeCloseTo(10)
  })

  it('returns empty array when all settled', () => {
    expect(computeSettlements({ m1: 0, m2: 0 })).toHaveLength(0)
  })

  it('minimises number of transfers', () => {
    // 3 debtors, 1 creditor → 3 transfers minimum (greedy)
    const balances = { m1: 30, m2: -10, m3: -10, m4: -10 }
    const transfers = computeSettlements(balances)
    expect(transfers.length).toBeLessThanOrEqual(3)
    const total = transfers.reduce((s, t) => s + t.amount, 0)
    expect(total).toBeCloseTo(30)
  })
})
