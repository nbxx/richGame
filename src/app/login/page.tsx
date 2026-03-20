'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Ensure we start with a clean slate
    supabase.auth.signOut()
    console.log('[Auth] Initializing Login Page - Session cleared')
  }, [])

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const sanitizedEmail = email.trim().toLowerCase()
    console.log('Sending OTP to:', sanitizedEmail)
    const { error } = await supabase.auth.signInWithOtp({
      email: sanitizedEmail,
      options: {
        shouldCreateUser: true,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setStep('otp')
    }
    setLoading(false)
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const sanitizedEmail = email.trim().toLowerCase()
    console.log('Verifying OTP for:', sanitizedEmail)
    // 1. Standard Email OTP Type
    console.log('[Auth] Attempting "email" type verification:', { email: sanitizedEmail, token: otp })
    let { data, error: otpError } = await supabase.auth.verifyOtp({
      email: sanitizedEmail,
      token: otp,
      type: 'email',
    })

    // 2. Signup Type Fallback (often needed for first-time OTP signups)
    if (otpError) {
      console.warn('[Auth] "email" type failed, trying "signup" fallback...', otpError)
      const signupResult = await supabase.auth.verifyOtp({
        email: sanitizedEmail,
        token: otp,
        type: 'signup',
      })
      data = signupResult.data
      otpError = signupResult.error
    }

    if (otpError) {
      console.error('[Auth] Final Verification Failure:', otpError)
      setError('验证码无效或已过期，请再次尝试或重新发送')
    } else {
      console.log('OTP Verified successfully:', data)
      window.location.href = '/dashboard'
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: '1rem',
    }}>
      <div className="card fade-in" style={{ maxWidth: '420px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            💰 RichGame
          </h1>
          <p className="text-secondary" style={{ fontSize: '0.9375rem' }}>
            美股模拟交易游戏
          </p>
          <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
            初始资金 $100,000 · 真实价格 · 实时排名
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendOTP}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              邮箱地址
            </label>
            <input
              id="email-input"
              type="email"
              className="input"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              style={{ marginBottom: '1rem' }}
            />
            <button
              id="send-otp-btn"
              type="submit"
              className="btn btn-primary"
              disabled={loading || !email}
              style={{ width: '100%' }}
            >
              {loading ? '发送中...' : '发送验证码'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              验证码已发送到 <strong style={{ color: 'var(--blue)' }}>{email}</strong>
            </p>
            <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '1rem' }}>
              请输入邮件中的6位数字验证码，或直接点击邮件中的链接登录
            </p>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              6位数字验证码
            </label>
            <input
              id="otp-input"
              type="text"
              className="input"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              autoFocus
              style={{ marginBottom: '1rem', fontFamily: 'var(--font-geist-mono)', fontSize: '1.5rem', textAlign: 'center', letterSpacing: '0.3em' }}
            />
            <button
              id="verify-otp-btn"
              type="submit"
              className="btn btn-primary"
              disabled={loading || otp.length !== 6}
              style={{ width: '100%', marginBottom: '0.75rem' }}
            >
              {loading ? '验证中...' : '登录'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => { setStep('email'); setOtp(''); setError(''); }}
              style={{ width: '100%' }}
            >
              重新发送验证码
            </button>
          </form>
        )}

        {error && (
          <p style={{ color: 'var(--red)', fontSize: '0.8125rem', marginTop: '1rem', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
