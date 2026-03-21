'use client'

import { useState, useEffect, useCallback } from 'react'
import { TradeModal } from '@/components/TradeModal'

interface Stock {
  symbol: string
  companyName: string
  exchange: string
  sector: string
  price: number
  previousClose: number
  change: number
  changePercent: number
}

export default function StocksPage() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [filtered, setFiltered] = useState<Stock[]>([])
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [tradeSymbol, setTradeSymbol] = useState<string | null>(null)
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof Stock; dir: 'asc' | 'desc' } | null>(null)

  const handleSort = (key: keyof Stock) => {
    let dir: 'asc' | 'desc' = 'asc'
    if (sortConfig?.key === key && sortConfig.dir === 'asc') dir = 'desc'
    setSortConfig({ key, dir })
  }

  const sortedFiltered = [...filtered].sort((a, b) => {
    if (!sortConfig) return 0
    const { key, dir } = sortConfig
    if (a[key] < b[key]) return dir === 'asc' ? -1 : 1
    if (a[key] > b[key]) return dir === 'asc' ? 1 : -1
    return 0
  })

  const fetchStocks = useCallback(async () => {
    try {
      const res = await fetch('/api/stocks')
      const data = await res.json()
      setStocks(data.stocks || [])
      setLoading(false)
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStocks()
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchStocks()
      }
    }, 120000) // Refresh every 120s and only if tab is visible
    return () => clearInterval(interval)
  }, [fetchStocks])

  useEffect(() => {
    let result = stocks
    if (search) {
      const q = search.toUpperCase()
      result = result.filter(
        (s) => s.symbol.includes(q) || s.companyName.toUpperCase().includes(q)
      )
    }
    if (sectorFilter !== 'All') {
      result = result.filter((s) => s.sector === sectorFilter)
    }
    setFiltered(result)
  }, [stocks, search, sectorFilter])

  const sectors = ['All', ...Array.from(new Set(stocks.map((s) => s.sector).filter(Boolean)))]
  const fmt = (n: number) => n > 0 ? `$${n.toFixed(2)}` : '—'

  if (loading) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="text-muted">加载股票数据...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container fade-in">
      <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: '1.5rem' }}>📈 股票列表</h2>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <input
          id="stock-search"
          className="input"
          placeholder="搜索股票代码或公司名..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '320px' }}
        />
        <select
          id="sector-filter"
          className="input"
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          style={{ maxWidth: '200px' }}
        >
          {sectors.map((s) => (
            <option key={s} value={s}>{s === 'All' ? '全部行业' : s}</option>
          ))}
        </select>
        <span className="text-muted" style={{ alignSelf: 'center', fontSize: '0.8125rem' }}>
          共 {filtered.length} 只
        </span>
      </div>

      {/* Stock Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('symbol')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                代码 {sortConfig?.key === 'symbol' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => handleSort('companyName')} className="hide-on-mobile" style={{ cursor: 'pointer', userSelect: 'none' }}>
                公司 {sortConfig?.key === 'companyName' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => handleSort('sector')} className="hide-on-mobile" style={{ cursor: 'pointer', userSelect: 'none' }}>
                行业 {sortConfig?.key === 'sector' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => handleSort('price')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                现价 {sortConfig?.key === 'price' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => handleSort('change')} className="hide-on-mobile" style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                涨跌 {sortConfig?.key === 'change' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => handleSort('changePercent')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                涨跌幅 {sortConfig?.key === 'changePercent' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedFiltered.map((stock) => (
              <tr key={stock.symbol}>
                <td style={{ fontWeight: 700 }}>{stock.symbol}</td>
                <td className="text-secondary hide-on-mobile" style={{ fontSize: '0.8125rem' }}>{stock.companyName}</td>
                <td className="hide-on-mobile">
                  <span className="badge badge-blue">{stock.sector}</span>
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono)', fontWeight: 600 }}>
                  {fmt(stock.price)}
                </td>
                <td className="hide-on-mobile" style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono)' }}>
                  <span className={stock.change >= 0 ? 'text-green' : 'text-red'}>
                    {stock.change >= 0 ? '+' : ''}{stock.change?.toFixed(2) ?? '—'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className={`badge ${stock.changePercent >= 0 ? 'badge-green' : 'badge-red'}`}>
                    {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2) ?? '0.00'}%
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                    onClick={() => setTradeSymbol(stock.symbol)}
                  >
                    交易
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      {tradeSymbol && (
        <TradeModal
          symbol={tradeSymbol}
          onClose={() => setTradeSymbol(null)}
          onTradeComplete={() => { setTradeSymbol(null); fetchStocks(); }}
        />
      )}
    </div>
  )
}
