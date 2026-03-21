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
    }, 60000) // Refresh every 60s and only if tab is visible
    return () => clearInterval(interval)
  }, [fetchData])

  const portfolioValue = holdings.reduce((sum, h) => sum + h.marketValue, 0)
  const totalAssets = cashBalance + portfolioValue

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

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
      <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: '1.5rem' }}>📊 资产概览</h2>

      {/* Asset Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card">
          <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.375rem' }}>总资产</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--gold)' }}>{fmt(totalAssets)}</p>
        </div>
        <div className="card">
          <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.375rem' }}>现金余额</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{fmt(cashBalance)}</p>
        </div>
        <div className="card">
          <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.375rem' }}>持仓市值</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--blue)' }}>{fmt(portfolioValue)}</p>
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
                <th onClick={() => handleSort('symbol')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  股票 {sortConfig?.key === 'symbol' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('quantity')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                  持仓量 {sortConfig?.key === 'quantity' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('avgCost')} className="hide-on-mobile" style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                  均价 {sortConfig?.key === 'avgCost' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('currentPrice')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                  现价 {sortConfig?.key === 'currentPrice' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('marketValue')} className="hide-on-mobile" style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                  市值 {sortConfig?.key === 'marketValue' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('gainLoss')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                  盈亏 {sortConfig?.key === 'gainLoss' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
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
                    <button className="btn btn-outline" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}
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
