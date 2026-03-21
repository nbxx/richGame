'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export function NavBar() {
  const pathname = usePathname()
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [showEmail, setShowEmail] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Don't show nav on login page
  if (pathname === '/login') return null

  const links = [
    { href: '/dashboard', label: '💼 资产' },
    { href: '/stocks', label: '📈 股票' },
    { href: '/transactions', label: '📋 记录' },
    { href: '/leaderboard', label: '🏆 排行榜' },
  ]

  return (
    <nav className="nav-bar">
      <div className="nav-container-left" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <Link href="/dashboard" className="nav-brand" style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--gold)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span>💰</span>
          <span className="nav-brand-text">RichGame</span>
        </Link>
        <div className="nav-links">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${pathname === link.href ? 'active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      {user && (
        <div className="nav-container-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span 
            className="text-muted nav-email" 
            style={{ fontSize: '0.8125rem', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center' }}
            onClick={() => setShowEmail(!showEmail)}
            title="点击切换邮箱显示"
          >
            {showEmail ? user.email : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
                <line x1="2" y1="2" x2="22" y2="22"></line>
              </svg>
            )}
          </span>
          <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
            登出
          </button>
        </div>
      )}
    </nav>
  )
}
