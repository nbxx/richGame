'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TradeModal } from '@/components/TradeModal'

interface Holding {
  symbol: string
  quantity: number
  avgCost: number
  currentPrice: number
  marketValue: number
  gainLoss: number
  gainLossPercent: number
}

const supabase = createClient()

export default function DashboardPage() {
  const router = useRouter()
  const [cashBalance, setCashBalance] = useState(0)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [tradeSymbol, setTradeSymbol] = useState<string | null>(null)
  const [sortConfig, setSortConfig] = useState<{ key: keyof Holding; dir: 'asc' | 'desc' } | null>(null)

  const handleSort = (key: keyof Holding) => {
    let dir: 'asc' | 'desc' = 'asc'
    if (sortConfig?.key === key && sortConfig.dir === 'asc') dir = 'desc'
    setSortConfig({ key, dir })
  }

  const sortedHoldings = [...holdings].sort((a, b) => {
    if (!sortConfig) return 0
    const { key, dir } = sortConfig
    if (a[key] < b[key]) return dir === 'asc' ? -1 : 1
    if (a[key] > b[key]) return dir === 'asc' ? 1 : -1
    return 0
  })

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Get user cash balance
    const { data: userData } = await supabase
      .from('users')
      .select('cash_balance')
      .eq('id', user.id)
      .single()

    if (userData) setCashBalance(Number(userData.cash_balance))

    // Get holdings
    const { data: portfolios } = await supabase
      .from('portfolios')
      .select('symbol, quantity, avg_cost')
      .eq('user_id', user.id)
      .gt('quantity', 0)

    if (portfolios && portfolios.length > 0) {
      // Fetch only the prices we need for current holdings
      const symbols = portfolios.map(p => p.symbol).join(',')
      const res = await fetch(`/api/stocks?symbols=${symbols}`)
      const { stocks } = await res.json()
      const priceMap: Record<string, number> = {}
      for (const s of stocks || []) {
        priceMap[s.symbol] = Number(s.price)
      }

      const holdingsList: Holding[] = portfolios.map((p) => {
        const qty = Number(p.quantity)
        const avg = Number(p.avg_cost)
        const current = priceMap[p.symbol] || 0
        const mv = qty * current
        const gl = mv - qty * avg
        const glp = avg > 0 ? ((current - avg) / avg) * 100 : 0

        return {
          symbol: p.symbol,
          quantity: qty,
          avgCost: avg,
          currentPrice: current,
          marketValue: mv,
          gainLoss: gl,
          gainLossPercent: glp,
        }
      })
      setHoldings(holdingsList)
    } else {
      setHoldings([])
    }

    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchData()
      }
    }, 120000) // Refresh every 120s and only if tab is visible
    return () => clearInterval(interval)
  }, [fetchData])

  const portfolioValue = holdings.reduce((sum, h) => sum + h.marketValue, 0)
  const totalAssets = cashBalance + portfolioValue

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

  const portfolioPercent = totalAssets > 0 ? (portfolioValue / totalAssets) * 100 : 0
  const cashPercent = totalAssets > 0 ? (cashBalance / totalAssets) * 100 : 100

  if (loading) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="text-muted">加载中…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container fade-in">
      <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: '1.5rem' }}>📊 资产概览</h2>

      {/* Asset Summary Visual Card */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.375rem' }}>总资产</p>
        <p style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--gold)', lineHeight: 1, margin: 0, marginBottom: '1.5rem', letterSpacing: '-0.025em' }}>{fmt(totalAssets)}</p>

        {/* Progress Bar Container */}
        <div style={{ height: '14px', width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', display: 'flex', marginBottom: '1rem' }}>
          <div style={{ width: `${portfolioPercent}%`, background: 'var(--blue)', transition: 'width 0.5s ease-in-out' }} title={`持仓: ${fmt(portfolioValue)}`}></div>
          <div style={{ width: `${cashPercent}%`, background: 'var(--green)', transition: 'width 0.5s ease-in-out' }} title={`现金: ${fmt(cashBalance)}`}></div>
        </div>

        {/* Legend / Details */}
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--blue)', marginTop: '0.25rem', flexShrink: 0 }}></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.125rem' }}>持仓市值 ({portfolioPercent.toFixed(1)}%)</span>
              <span style={{ fontWeight: 700, fontSize: '1.125rem', fontFamily: 'var(--font-geist-mono)', lineHeight: 1 }}>{fmt(portfolioValue)}</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--green)', marginTop: '0.25rem', flexShrink: 0 }}></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.125rem' }}>现金余额 ({cashPercent.toFixed(1)}%)</span>
              <span style={{ fontWeight: 700, fontSize: '1.125rem', fontFamily: 'var(--font-geist-mono)', lineHeight: 1 }}>{fmt(cashBalance)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Holdings */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>持仓列表</h3>
        </div>
        {holdings.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <p className="text-muted">暂无持仓</p>
            <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.5rem' }}>
              前往 <a href="/stocks" style={{ color: 'var(--blue)' }}>股票列表</a> 开始交易
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
            <thead>
              <tr>
                <th style={{ padding: 0 }}>
                  <button type="button" onClick={() => handleSort('symbol')} style={{ all: 'unset', display: 'flex', width: '100%', padding: '0.75rem 1rem', cursor: 'pointer', boxSizing: 'border-box' }}>
                    股票 {sortConfig?.key === 'symbol' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th style={{ padding: 0, textAlign: 'right' }}>
                  <button type="button" onClick={() => handleSort('quantity')} style={{ all: 'unset', display: 'flex', width: '100%', justifyContent: 'flex-end', padding: '0.75rem 1rem', cursor: 'pointer', boxSizing: 'border-box' }}>
                    持仓量 {sortConfig?.key === 'quantity' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th className="hide-on-mobile" style={{ padding: 0, textAlign: 'right' }}>
                  <button type="button" onClick={() => handleSort('avgCost')} style={{ all: 'unset', display: 'flex', width: '100%', justifyContent: 'flex-end', padding: '0.75rem 1rem', cursor: 'pointer', boxSizing: 'border-box' }}>
                    均价 {sortConfig?.key === 'avgCost' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th style={{ padding: 0, textAlign: 'right' }}>
                  <button type="button" onClick={() => handleSort('currentPrice')} style={{ all: 'unset', display: 'flex', width: '100%', justifyContent: 'flex-end', padding: '0.75rem 1rem', cursor: 'pointer', boxSizing: 'border-box' }}>
                    现价 {sortConfig?.key === 'currentPrice' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th className="hide-on-mobile" style={{ padding: 0, textAlign: 'right' }}>
                  <button type="button" onClick={() => handleSort('marketValue')} style={{ all: 'unset', display: 'flex', width: '100%', justifyContent: 'flex-end', padding: '0.75rem 1rem', cursor: 'pointer', boxSizing: 'border-box' }}>
                    市值 {sortConfig?.key === 'marketValue' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th style={{ padding: 0, textAlign: 'right' }}>
                  <button type="button" onClick={() => handleSort('gainLoss')} style={{ all: 'unset', display: 'flex', width: '100%', justifyContent: 'flex-end', padding: '0.75rem 1rem', cursor: 'pointer', boxSizing: 'border-box' }}>
                    盈亏 {sortConfig?.key === 'gainLoss' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.map((h) => (
                <tr key={h.symbol}>
                  <td style={{ fontWeight: 600 }}>{h.symbol}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono)' }}>{h.quantity.toFixed(4)}</td>
                  <td className="hide-on-mobile" style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono)' }}>{fmt(h.avgCost)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono)' }}>{fmt(h.currentPrice)}</td>
                  <td className="hide-on-mobile" style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono)' }}>{fmt(h.marketValue)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={h.gainLoss >= 0 ? 'text-green' : 'text-red'} style={{ fontFamily: 'var(--font-geist-mono)', display: 'inline-block' }}>
                      <span className="hide-on-mobile">{fmt(h.gainLoss)} </span>
                      ({fmtPct(h.gainLossPercent)})
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                      onClick={() => setTradeSymbol(h.symbol)}>
                      交易
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </div>

      {tradeSymbol && (
        <TradeModal
          symbol={tradeSymbol}
          onClose={() => setTradeSymbol(null)}
          onTradeComplete={() => { setTradeSymbol(null); fetchData(); }}
        />
      )}
    </div>
  )
}
