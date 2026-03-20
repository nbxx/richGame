import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getQuote } from '@/lib/finnhub'
import { maskEmail } from '@/lib/email-mask'

/**
 * GET /api/leaderboard — Return latest leaderboard snapshot
 */
export async function GET() {
  try {
    const supabase = createAdminClient()

    // Get most recent snapshot time
    const { data: latest } = await supabase
      .from('leaderboard_snapshots')
      .select('snapshot_at')
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single()

    if (!latest) {
      return NextResponse.json({ leaderboard: [], lastUpdated: null })
    }

    // Get all entries for that snapshot
    const { data: entries, error } = await supabase
      .from('leaderboard_snapshots')
      .select(`
        rank,
        total_assets,
        cash_balance,
        portfolio_value,
        user_id,
        users ( email )
      `)
      .eq('snapshot_at', latest.snapshot_at)
      .order('rank', { ascending: true })

    if (error) {
      console.error('Leaderboard fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
    }

    const leaderboard = (entries || []).map((entry) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userData = entry.users as any
      const email = userData?.email || 'unknown'
      return {
        rank: entry.rank,
        displayName: maskEmail(email),
        totalAssets: Number(entry.total_assets),
        cashBalance: Number(entry.cash_balance),
        portfolioValue: Number(entry.portfolio_value),
        userId: entry.user_id,
      }
    })

    return NextResponse.json({
      leaderboard,
      lastUpdated: latest.snapshot_at,
    })
  } catch (e) {
    console.error('Leaderboard GET error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/leaderboard — Recalculate and create a new leaderboard snapshot
 */
export async function POST() {
  try {
    const supabase = createAdminClient()

    // 1. Get all active users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, cash_balance')
      .eq('is_active', true)

    if (usersError || !users || users.length === 0) {
      return NextResponse.json({ error: 'No users found' }, { status: 404 })
    }

    // 2. For each user, calculate portfolio value
    const userAssets: Array<{
      userId: string
      cashBalance: number
      portfolioValue: number
      totalAssets: number
    }> = []

    for (const user of users) {
      const { data: holdings } = await supabase
        .from('portfolios')
        .select('symbol, quantity')
        .eq('user_id', user.id)
        .gt('quantity', 0)

      let portfolioValue = 0

      if (holdings && holdings.length > 0) {
        for (const holding of holdings) {
          // Try cache first, then Finnhub
          const { data: cached } = await supabase
            .from('stock_prices')
            .select('current_price')
            .eq('symbol', holding.symbol)
            .single()

          let price = cached?.current_price ? Number(cached.current_price) : 0

          if (price <= 0) {
            try {
              const quote = await getQuote(holding.symbol)
              price = quote.c
            } catch {
              // Use 0 if we can't get price
            }
          }

          portfolioValue += Number(holding.quantity) * price
        }
      }

      const cashBalance = Number(user.cash_balance)
      userAssets.push({
        userId: user.id,
        cashBalance,
        portfolioValue: Number(portfolioValue.toFixed(6)),
        totalAssets: Number((cashBalance + portfolioValue).toFixed(6)),
      })
    }

    // 3. Sort by total assets and assign ranks
    userAssets.sort((a, b) => b.totalAssets - a.totalAssets)

    const snapshotTime = new Date().toISOString()
    const snapshots = userAssets.map((ua, index) => ({
      user_id: ua.userId,
      cash_balance: ua.cashBalance,
      portfolio_value: ua.portfolioValue,
      total_assets: ua.totalAssets,
      rank: index + 1,
      snapshot_at: snapshotTime,
    }))

    // 4. Insert snapshot
    const { error: insertError } = await supabase
      .from('leaderboard_snapshots')
      .insert(snapshots)

    if (insertError) {
      console.error('Failed to insert leaderboard snapshot:', insertError)
      return NextResponse.json({ error: 'Failed to save leaderboard' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      playersRanked: snapshots.length,
      lastUpdated: snapshotTime,
    })
  } catch (e) {
    console.error('Leaderboard POST error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
