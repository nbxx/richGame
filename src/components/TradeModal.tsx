'use client'

import { useState, useEffect } from 'react'

interface TradeModalProps {
  symbol: string
  onClose: () => void
  onTradeComplete: () => void
}

export function TradeModal({ symbol, onClose, onTradeComplete }: TradeModalProps) {
  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY')
  const [mode, setMode] = useState<'quantity' | 'amount'>('amount')
  const [inputValue, setInputValue] = useState('')
  const [stockData, setStockData] = useState<{ price: number; companyName: string; change: number; changePercent: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch(`/api/stocks/${symbol}`)
      .then((r) => r.json())
      .then(setStockData)
      .catch(() => setError('Failed to load stock'))
  }, [symbol])

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
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
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-geist-mono)' }}>{fmt(price)}</span>
            <span className={stockData.change >= 0 ? 'text-green' : 'text-red'} style={{ marginLeft: '0.75rem', fontSize: '0.875rem', fontFamily: 'var(--font-geist-mono)' }}>
              {stockData.change >= 0 ? '+' : ''}{stockData.change?.toFixed(2)} ({stockData.changePercent?.toFixed(2)}%)
            </span>
          </div>
        )}

        {/* Buy/Sell Toggle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <button
            className={`btn ${action === 'BUY' ? 'btn-green' : 'btn-outline'}`}
            onClick={() => setAction('BUY')}
          >
            买入
          </button>
          <button
            className={`btn ${action === 'SELL' ? 'btn-red' : 'btn-outline'}`}
            onClick={() => setAction('SELL')}
          >
            卖出
          </button>
        </div>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            className={`btn ${mode === 'amount' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, padding: '0.375rem' }}
            onClick={() => { setMode('amount'); setInputValue(''); }}
          >
            按金额 ($)
          </button>
          <button
            className={`btn ${mode === 'quantity' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, padding: '0.375rem' }}
            onClick={() => { setMode('quantity'); setInputValue(''); }}
          >
            按股数
          </button>
        </div>

        {/* Input */}
        <div style={{ marginBottom: '1rem' }}>
          <label className="text-secondary" style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
            {mode === 'amount' ? '金额 (USD)' : '股数'}
          </label>
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
          />
        </div>

        {/* Estimate */}
        {numValue > 0 && price > 0 && (
          <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.8125rem' }}>
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
          style={{ width: '100%', padding: '0.75rem' }}
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
