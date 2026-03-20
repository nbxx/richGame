'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TradeModalProps {
  symbol: string
  onClose: () => void
  onTradeComplete: () => void
}

export function TradeModal({ symbol, onClose, onTradeComplete }: TradeModalProps) {
  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY')
  const [mode, setMode] = useState<'quantity' | 'amount'>('quantity')
  const [inputValue, setInputValue] = useState('')
  const [stockData, setStockData] = useState<{ price: number; companyName: string; change: number; changePercent: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [userCash, setUserCash] = useState<number | null>(null)
  const [userHoldings, setUserHoldings] = useState<number>(0)
  const supabase = createClient()

  const fetchUserData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get cash
    const { data: userData } = await supabase
      .from('users')
      .select('cash_balance')
      .eq('id', user.id)
      .single()
    if (userData) setUserCash(Number(userData.cash_balance))

    // Get holdings for this symbol
    const { data: holding } = await supabase
      .from('portfolios')
      .select('quantity')
      .eq('user_id', user.id)
      .eq('symbol', symbol)
      .single()
    setUserHoldings(holding ? Number(holding.quantity) : 0)
  }, [symbol, supabase])

  useEffect(() => {
    fetch(`/api/stocks/${symbol}`)
      .then((r) => r.json())
      .then(setStockData)
      .catch(() => setError('Failed to load stock'))
    
    fetchUserData()
  }, [symbol, fetchUserData])

  const price = stockData?.price || 0
  const numValue = parseFloat(inputValue) || 0
  const estimatedQty = mode === 'amount' ? (price > 0 ? numValue / price : 0) : numValue
  const estimatedTotal = mode === 'quantity' ? numValue * price : numValue

  const handleTrade = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    const body: Record<string, unknown> = { symbol, action }
    if (mode === 'quantity') {
      body.quantity = numValue
    } else {
      body.amount = numValue
    }

    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Trade failed')
      } else {
        setSuccess(`${action === 'BUY' ? '买入' : '卖出'}成功! ${data.trade.quantity.toFixed(4)} 股 @ $${data.trade.price.toFixed(2)}`)
        fetchUserData() // Refresh local data
        setTimeout(onTradeComplete, 1500)
      }
    } catch {
      setError('Network error')
    }
    setLoading(false)
  }

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{symbol}</h3>
            {stockData && (
              <p className="text-secondary" style={{ fontSize: '0.8125rem' }}>{stockData.companyName}</p>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Price */}
        {stockData && (
          <div style={{ marginBottom: '0.75rem', padding: '0.625rem 1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-geist-mono)' }}>{fmt(price)}</span>
            <span className={stockData.change >= 0 ? 'text-green' : 'text-red'} style={{ marginLeft: '0.75rem', fontSize: '0.875rem', fontFamily: 'var(--font-geist-mono)' }}>
              {stockData.change >= 0 ? '+' : ''}{stockData.change?.toFixed(2)} ({stockData.changePercent?.toFixed(2)}%)
            </span>
          </div>
        )}

        {/* Buy/Sell Toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button
            className={`btn ${action === 'BUY' ? 'btn-green' : 'btn-outline'}`}
            onClick={() => { setAction('BUY'); setInputValue(''); }}
          >
            买入
          </button>
          <button
            className={`btn ${action === 'SELL' ? 'btn-red' : 'btn-outline'}`}
            onClick={() => { setAction('SELL'); setInputValue(''); }}
          >
            卖出
          </button>
        </div>

        {/* User Status Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
          <div className="text-secondary">
            可用金额: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{userCash !== null ? fmt(userCash) : '...'}</span>
          </div>
          <div className="text-secondary">
            当前持持仓: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{userHoldings.toFixed(4)} 股</span>
          </div>
        </div>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button
            className={`btn ${mode === 'quantity' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, padding: '0.375rem' }}
            onClick={() => { setMode('quantity'); setInputValue(''); }}
          >
            按股数
          </button>
          <button
            className={`btn ${mode === 'amount' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, padding: '0.375rem' }}
            onClick={() => { setMode('amount'); setInputValue(''); }}
          >
            按金额 ($)
          </button>
        </div>

        {/* Input */}
        <div style={{ marginBottom: '0.75rem' }}>
          <label className="text-secondary" style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
            {mode === 'amount' ? '金额 (USD)' : '股数'}
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              id="trade-input"
              type="number"
              className="input"
              placeholder={mode === 'amount' ? '1000.00' : '10'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              min="0"
              step={mode === 'amount' ? '0.01' : '0.000001'}
              autoFocus
              style={{ width: '100%' }}
            />
            {action === 'SELL' && mode === 'quantity' && userHoldings > 0 && (
              <button
                type="button"
                onClick={() => setInputValue(userHoldings.toString())}
                style={{
                  position: 'absolute',
                  right: '3rem',
                  padding: '0.125rem 0.5rem',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  background: 'var(--blue)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  zIndex: 10
                }}
              >
                MAX
              </button>
            )}
          </div>
        </div>

        {/* Estimate */}
        {numValue > 0 && price > 0 && (
          <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem', fontSize: '0.8125rem' }}>
            {mode === 'amount' ? (
              <p>预计 {action === 'BUY' ? '买入' : '卖出'} <strong>{estimatedQty.toFixed(4)}</strong> 股</p>
            ) : (
              <p>预计总金额 <strong>{fmt(estimatedTotal)}</strong></p>
            )}
          </div>
        )}

        {/* Submit */}
        <button
          id="confirm-trade-btn"
          className={`btn ${action === 'BUY' ? 'btn-green' : 'btn-red'}`}
          style={{ width: '100%', padding: '0.625rem' }}
          onClick={handleTrade}
          disabled={loading || numValue <= 0}
        >
          {loading ? '处理中...' : `确认${action === 'BUY' ? '买入' : '卖出'}`}
        </button>

        {error && <p style={{ color: 'var(--red)', marginTop: '0.75rem', fontSize: '0.8125rem', textAlign: 'center' }}>{error}</p>}
        {success && <p style={{ color: 'var(--green)', marginTop: '0.75rem', fontSize: '0.8125rem', textAlign: 'center' }}>{success}</p>}
      </div>
    </div>
  )
}
