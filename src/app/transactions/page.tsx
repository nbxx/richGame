'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Transaction {
  id: string
  symbol: string
  action: 'BUY' | 'SELL'
  quantity: number
  price: number
  total_amount: number
  cash_after: number
  created_at: string
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setTransactions(data || [])
      setLoading(false)
    }
    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtDate = (s: string) => {
    const d = new Date(s)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="text-muted">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container fade-in">
      <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: '1.5rem' }}>📋 交易记录</h2>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {transactions.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <p className="text-muted">暂无交易记录</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>股票</th>
                <th>操作</th>
                <th style={{ textAlign: 'right' }}>数量</th>
                <th style={{ textAlign: 'right' }}>成交价</th>
                <th style={{ textAlign: 'right' }}>成交金额</th>
                <th style={{ textAlign: 'right' }}>余额</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="text-secondary" style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    {fmtDate(tx.created_at)}
                  </td>
                  <td style={{ fontWeight: 600 }}>{tx.symbol}</td>
                  <td>
                    <span className={`badge ${tx.action === 'BUY' ? 'badge-green' : 'badge-red'}`}>
                      {tx.action === 'BUY' ? '买入' : '卖出'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono)' }}>
                    {Number(tx.quantity).toFixed(4)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono)' }}>
                    {fmt(tx.price)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono)', fontWeight: 600 }}>
                    {fmt(tx.total_amount)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono)' }} className="text-secondary">
                    {fmt(tx.cash_after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
