import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getQuote } from '@/lib/finnhub'

interface TradeRequest {
  symbol: string
  action: 'BUY' | 'SELL'
  quantity?: number
  amount?: number // in USD — will be converted to quantity
}

/**
 * POST /api/trade — Execute a market order
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse request
    const body: TradeRequest = await request.json()
    const { symbol, action } = body
    let { quantity, amount } = body

    if (!symbol || !action) {
      return NextResponse.json({ error: 'Missing symbol or action' }, { status: 400 })
    }

    if (action !== 'BUY' && action !== 'SELL') {
      return NextResponse.json({ error: 'Action must be BUY or SELL' }, { status: 400 })
    }

    if (!quantity && !amount) {
      return NextResponse.json({ error: 'Provide quantity or amount' }, { status: 400 })
    }

    const upperSymbol = symbol.toUpperCase()
    const admin = createAdminClient()

    // 3. Check stock is tradable
    const { data: stock } = await admin
      .from('stocks')
      .select('symbol, is_active')
      .eq('symbol', upperSymbol)
      .single()

    if (!stock || !stock.is_active) {
      return NextResponse.json({ error: 'Stock not tradable' }, { status: 400 })
    }

    // 4. Get real-time price
    let price: number
    try {
      const quote = await getQuote(upperSymbol)
      price = quote.c
      if (price <= 0) {
        return NextResponse.json({ error: 'Cannot get valid price. Market may be closed.' }, { status: 400 })
      }

      // Also update cache
      await admin.from('stock_prices').upsert({
        symbol: upperSymbol,
        current_price: quote.c,
        previous_close: quote.pc,
        change_amount: quote.d,
        change_percent: quote.dp,
        market_open: true,
        cached_at: new Date().toISOString(),
      })
    } catch {
      return NextResponse.json({ error: 'Failed to get stock price. Try again.' }, { status: 503 })
    }

    // 5. Convert amount to quantity if needed
    if (amount && !quantity) {
      if (action === 'BUY') {
        // Floor to 6 decimals to avoid floating-point overshoots strictly exceeding cash balance
        quantity = Math.floor((amount / price) * 1000000) / 1000000
      } else {
        quantity = Number((amount / price).toFixed(6))
      }
    }

    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
    }

    // Round quantity to 6 decimal places
    quantity = Number(quantity.toFixed(6))
    const totalAmount = Number((quantity * price).toFixed(6))

    // 6. Get user's current state
    const { data: userData, error: userError } = await admin
      .from('users')
      .select('cash_balance')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const cashBalance = Number(userData.cash_balance)

    // 7. Validate the trade
    if (action === 'BUY') {
      if (totalAmount > cashBalance) {
        return NextResponse.json({
          error: `Insufficient funds. Need $${totalAmount.toFixed(2)}, have $${cashBalance.toFixed(2)}`,
        }, { status: 400 })
      }
    } else {
      // SELL — check holdings
      const { data: holding } = await admin
        .from('portfolios')
        .select('quantity')
        .eq('user_id', user.id)
        .eq('symbol', upperSymbol)
        .single()

      const currentQty = holding ? Number(holding.quantity) : 0
      if (quantity > currentQty) {
        return NextResponse.json({
          error: `Insufficient shares. Have ${currentQty}, trying to sell ${quantity}`,
        }, { status: 400 })
      }
    }

    // 8. Execute trade
    const cashBefore = cashBalance
    const cashAfter = action === 'BUY'
      ? Number((cashBalance - totalAmount).toFixed(6))
      : Number((cashBalance + totalAmount).toFixed(6))

    // Update cash balance
    const { error: cashError } = await admin
      .from('users')
      .update({ cash_balance: cashAfter })
      .eq('id', user.id)

    if (cashError) {
      return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 })
    }

    // Update portfolio
    if (action === 'BUY') {
      const { data: existing } = await admin
        .from('portfolios')
        .select('quantity, avg_cost')
        .eq('user_id', user.id)
        .eq('symbol', upperSymbol)
        .single()

      if (existing) {
        const oldQty = Number(existing.quantity)
        const oldAvg = Number(existing.avg_cost)
        const newQty = Number((oldQty + quantity).toFixed(6))
        const newAvg = oldQty + quantity > 0
          ? Number(((oldQty * oldAvg + quantity * price) / newQty).toFixed(6))
          : price

        await admin
          .from('portfolios')
          .update({ quantity: newQty, avg_cost: newAvg })
          .eq('user_id', user.id)
          .eq('symbol', upperSymbol)
      } else {
        await admin
          .from('portfolios')
          .insert({
            user_id: user.id,
            symbol: upperSymbol,
            quantity,
            avg_cost: price,
          })
      }
    } else {
      // SELL
      const { data: existing } = await admin
        .from('portfolios')
        .select('quantity')
        .eq('user_id', user.id)
        .eq('symbol', upperSymbol)
        .single()

      if (existing) {
        const newQty = Number((Number(existing.quantity) - quantity).toFixed(6))
        await admin
          .from('portfolios')
          .update({ quantity: Math.max(0, newQty) })
          .eq('user_id', user.id)
          .eq('symbol', upperSymbol)
      }
    }

    // Insert transaction record
    const { error: txError } = await admin
      .from('transactions')
      .insert({
        user_id: user.id,
        symbol: upperSymbol,
        action,
        quantity,
        price,
        total_amount: totalAmount,
        cash_before: cashBefore,
        cash_after: cashAfter,
      })

    if (txError) {
      console.error('Failed to record transaction:', txError)
      // Trade already executed, just log error
    }

    return NextResponse.json({
      success: true,
      trade: {
        symbol: upperSymbol,
        action,
        quantity,
        price,
        totalAmount,
        cashAfter,
      },
    })
  } catch (e) {
    console.error('Trade API error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
