'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LeaderboardEntry {
  rank: number
  displayName: string
  totalAssets: number
  cashBalance: number
  portfolioValue: number
  userId: string
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
    fetchLeaderboard()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard')
      const data = await res.json()
      setEntries(data.leaderboard || [])
      setLastUpdated(data.lastUpdated)
    } catch {
      // ignore
    }
    setLoading(false)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetch('/api/leaderboard', { method: 'POST' })
      await fetchLeaderboard()
    } catch {
      // ignore
    }
    setRefreshing(false)
  }

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  const fmtDate = (s: string) => new Date(s).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { color: '#fbbf24', fontSize: '1.125rem' }
    if (rank === 2) return { color: '#9ca3af', fontSize: '1.0625rem' }
    if (rank === 3) return { color: '#cd7f32', fontSize: '1.0625rem' }
    return {}
  }

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="text-muted">加载排行榜...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 700 }}>🏆 排行榜</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {lastUpdated && (
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>
              更新于 {fmtDate(lastUpdated)}
            </span>
          )}
          <button
            id="refresh-leaderboard-btn"
            className="btn btn-outline"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }}
          >
            {refreshing ? '计算中...' : '🔄 刷新排名'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {entries.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <p className="text-muted">暂无排行数据</p>
            <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.5rem' }}>
              点击"刷新排名"按钮生成排行榜
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>排名</th>
                <th>玩家</th>
                <th style={{ textAlign: 'right' }}>总资产</th>
                <th style={{ textAlign: 'right' }}>现金</th>
                <th style={{ textAlign: 'right' }}>持仓</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.userId} className={entry.userId === currentUserId ? 'highlight' : ''}>
                  <td>
                    <span style={{ fontWeight: 700, ...getRankStyle(entry.rank) }}>
                      {getRankEmoji(entry.rank)}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '0.875rem' }}>
                      {entry.displayName}
                    </span>
                    {entry.userId === currentUserId && (
                      <span className="badge badge-blue" style={{ marginLeft: '0.5rem' }}>你</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono)', fontWeight: 700, color: 'var(--gold)' }}>
                    {fmt(entry.totalAssets)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono)' }} className="text-secondary">
                    {fmt(entry.cashBalance)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-geist-mono)' }} className="text-secondary">
                    {fmt(entry.portfolioValue)}
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
