'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export function NavBar() {
  const pathname = usePathname()
  const [user, setUser] = useState<{ email?: string } | null>(null)
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
          <span className="text-muted nav-email" style={{ fontSize: '0.8125rem' }}>{user.email}</span>
          <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
            登出
          </button>
        </div>
      )}
    </nav>
  )
}
