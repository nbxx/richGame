-- =============================================
-- 美股模拟交易游戏 — 数据库完整迁移脚本
-- Phase 1 + Phase 2 预留表
-- 在 Supabase SQL Editor 中运行此脚本
-- =============================================

-- ==================
-- Phase 1 Tables
-- ==================

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT NOT NULL UNIQUE,
  cash_balance     NUMERIC(20,6) NOT NULL DEFAULT 100000.000000,
  initial_balance  NUMERIC(20,6) NOT NULL DEFAULT 100000.000000,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at    TIMESTAMPTZ
);

-- Stocks — preset tradable stock list
CREATE TABLE IF NOT EXISTS public.stocks (
  symbol           TEXT PRIMARY KEY,
  company_name     TEXT NOT NULL,
  exchange         TEXT NOT NULL,
  sector           TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stock prices cache
CREATE TABLE IF NOT EXISTS public.stock_prices (
  symbol           TEXT PRIMARY KEY REFERENCES public.stocks(symbol) ON DELETE CASCADE,
  current_price    NUMERIC(20,6) NOT NULL DEFAULT 0,
  previous_close   NUMERIC(20,6),
  change_amount    NUMERIC(20,6),
  change_percent   NUMERIC(10,4),
  volume           BIGINT,
  market_open      BOOLEAN NOT NULL DEFAULT false,
  cached_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Portfolios — user holdings
CREATE TABLE IF NOT EXISTS public.portfolios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  symbol           TEXT NOT NULL REFERENCES public.stocks(symbol),
  quantity         NUMERIC(20,6) NOT NULL DEFAULT 0,
  avg_cost         NUMERIC(20,6) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

-- Transactions — trade history (core audit table)
CREATE TABLE IF NOT EXISTS public.transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  symbol           TEXT NOT NULL REFERENCES public.stocks(symbol),
  action           TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
  quantity         NUMERIC(20,6) NOT NULL,
  price            NUMERIC(20,6) NOT NULL,
  total_amount     NUMERIC(20,6) NOT NULL,
  cash_before      NUMERIC(20,6) NOT NULL,
  cash_after       NUMERIC(20,6) NOT NULL,
  fee              NUMERIC(20,6) NOT NULL DEFAULT 0,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_time
  ON public.transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_symbol_time
  ON public.transactions (symbol, created_at DESC);

-- Leaderboard snapshots
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cash_balance     NUMERIC(20,6) NOT NULL,
  portfolio_value  NUMERIC(20,6) NOT NULL,
  total_assets     NUMERIC(20,6) NOT NULL,
  rank             INTEGER NOT NULL,
  snapshot_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshot_time
  ON public.leaderboard_snapshots (snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_user_time
  ON public.leaderboard_snapshots (user_id, snapshot_at DESC);

-- ==================
-- Phase 2 预留 Tables
-- ==================

-- Admin whitelist
CREATE TABLE IF NOT EXISTS public.admin_users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL UNIQUE,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note             TEXT
);

-- Admin subscriptions to watch players
CREATE TABLE IF NOT EXISTS public.admin_subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id             UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  watched_user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  noti_inapp_enabled   BOOLEAN NOT NULL DEFAULT true,
  noti_email_enabled   BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(admin_id, watched_user_id)
);

-- Admin notification log
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id         UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  transaction_id   UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  watched_user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel          TEXT NOT NULL CHECK (channel IN ('inapp', 'email')),
  status           TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at          TIMESTAMPTZ
);

-- ==================
-- Triggers
-- ==================

-- Auto-create user profile when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, cash_balance, initial_balance)
  VALUES (NEW.id, NEW.email, 100000.000000, 100000.000000);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_portfolios_updated_at ON public.portfolios;
CREATE TRIGGER update_portfolios_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ==================
-- Row Level Security
-- ==================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Users: read/update own data only
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Stocks: everyone can read
CREATE POLICY "Anyone can view stocks"
  ON public.stocks FOR SELECT
  TO authenticated
  USING (true);

-- Stock prices: everyone can read
CREATE POLICY "Anyone can view stock prices"
  ON public.stock_prices FOR SELECT
  TO authenticated
  USING (true);

-- Portfolios: read/update own data only
CREATE POLICY "Users can view own portfolios"
  ON public.portfolios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolios"
  ON public.portfolios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolios"
  ON public.portfolios FOR UPDATE
  USING (auth.uid() = user_id);

-- Transactions: read own data only (written by service role)
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Leaderboard: everyone can read (anonymous data)
CREATE POLICY "Anyone can view leaderboard"
  ON public.leaderboard_snapshots FOR SELECT
  TO authenticated
  USING (true);

-- Admin tables: no access from game client (service role only)
-- No policies needed — RLS enabled but no ALLOW policies means denied by default
