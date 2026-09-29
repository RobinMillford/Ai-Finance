/**
 * verify:postgres — end-to-end PostgreSQL/Drizzle verification (spec §1–§10).
 *
 * Runs the real committed migration (idempotent — drizzle's journal skips
 * already-applied statements), then proves every contract the migration
 * promises, using only synthetic data (no provider calls, no secrets logged).
 * Every row this script creates is tagged `verify-*@example.com` and removed
 * at the end (cascades clean dependents).
 *
 * Usage: DATABASE_URL=postgres://… npm run verify:postgres
 * Exit code 0 = all checks passed; 1 = at least one failure.
 *
 * NOTE (module loading): app modules are imported DYNAMICALLY inside main().
 * The tsconfig-paths register below must run FIRST; a static import would be
 * hoisted by CJS emit and require '@/…' before alias resolution exists.
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ── .env loading (same precedence as the app: .env then .env.local) ──────────
function loadDotEnv(file: string): void {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadDotEnv(path.resolve(process.cwd(), '.env'));
loadDotEnv(path.resolve(process.cwd(), '.env.local'));

// ── path aliases (@/*) via tsconfig-paths, before ANY app module loads ──────
import { register } from 'tsconfig-paths';
import * as ts from 'typescript';

const tsconfig = ts.readConfigFile(path.resolve(process.cwd(), 'tsconfig.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, process.cwd());
register({
  baseUrl: parsed.options.baseUrl ? path.resolve(process.cwd(), parsed.options.baseUrl) : process.cwd(),
  paths: (parsed.options.paths as Record<string, string[]>) ?? {},
});

// ── reporting scaffolding (no app imports needed at module scope) ───────────
let passed = 0;
let failed = 0;

function pass(name: string, detail?: string) {
  passed += 1;
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, error: unknown) {
  failed += 1;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`  FAIL  ${name} — ${message}`);
}

/** Run one named check; never throws (failures are collected). */
async function check(name: string, fn: () => Promise<string | undefined>) {
  try {
    const detail = await fn();
    pass(name, detail);
  } catch (error) {
    fail(name, error);
  }
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function near(a: number, b: number, tol = 1e-6): boolean {
  return Math.abs(a - b) <= tol;
}

async function main(): Promise<number> {
  // App modules load only after the alias register above has run.
  const { getPool, getDb, closePool } = await import('@/lib/db/client');
  const { users } = await import('@/lib/db/schema');
  const { like } = await import('drizzle-orm');
  const usersRepo = await import('@/lib/db/repositories/users');
  const portfoliosRepo = await import('@/lib/db/repositories/portfolios');
  const watchlistsRepo = await import('@/lib/db/repositories/watchlists');
  const conversationsRepo = await import('@/lib/db/repositories/conversations');
  const authRepo = await import('@/lib/db/repositories/auth');
  const candlesRepo = await import('@/lib/db/repositories/candles');

  console.log('\nFinanceAI PostgreSQL Verification');
  console.log('='.repeat(72));

  const url = process.env.DATABASE_URL ?? '';
  if (!url) {
    console.error('DATABASE_URL is not set — nothing to verify.');
    return 1;
  }
  // Never print the URL (credentials).
  console.log(`Database: reachable target at ${new URL(url).host}`);

  /** Verify the committed migration applies (no-op when already up to date). */
  const runMigration = (): void => {
    execFileSync('npx', ['drizzle-kit', 'migrate'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  };

  /** Remove every row this verification created (cascades take dependents). */
  const cleanup = async (): Promise<void> => {
    await getDb().delete(users).where(like(users.email, 'verify-%@example.com'));
    await candlesRepo.deleteCandlesForSymbol('TEST');
  };

  // ── 0. Committed migration applies cleanly (idempotent re-run) ────────────
  console.log('\n[0] Committed drizzle migration applies cleanly');
  try {
    runMigration();
    pass('drizzle-kit migrate', 'no errors; journal up to date');
  } catch (e) {
    fail('drizzle-kit migrate', e);
  }

  try {
    await cleanup(); // clear leftovers from any previous interrupted run

    // ── 1. Identity: UUID PKs ────────────────────────────────────────────────
    await check('users.id is server-generated UUIDv4', async () => {
      const u = await usersRepo.createUser({ name: 'Verify PG', email: `verify-pg-${Date.now()}@example.com`, passwordHash: null });
      expect(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u.id), `not a UUID: ${u.id}`);
      return `id=${u.id.slice(0, 8)}…`;
    });

    // ── 2. Uniqueness + case-insensitive email ─────────────────────────────
    await check('duplicate email rejected; lookup is case-insensitive', async () => {
      const email = `verify-uniq-${Date.now()}@example.com`;
      const a = await usersRepo.createUser({ name: 'A', email });
      const dup = await usersRepo.createUser({ name: 'B', email: email.toUpperCase() }).then(
        () => null,
        (e) => e
      );
      expect(dup, 'duplicate email insert unexpectedly succeeded');
      const found = await usersRepo.getUserByEmail(email.toUpperCase());
      expect(found?.id === a.id, 'case-insensitive email lookup failed');
      return 'unique + lower() lookup OK';
    });

    // ── 3. NUMERIC precision ────────────────────────────────────────────────
    await check('money/quantity survive as exact decimal (NUMERIC 18,6)', async () => {
      const u = await usersRepo.createUser({ name: 'V', email: `verify-num-${Date.now()}@example.com` });
      const p = await portfoliosRepo.createPortfolio(u.id, { name: 'Num' });
      const withLots = await portfoliosRepo.addPosition(u.id, p.id, {
        symbol: 'NUM',
        assetType: 'stock',
        quantity: 0.000123,
        purchasePrice: 12345.678901,
      });
      expect(withLots, 'addPosition returned null');
      const h = withLots.holdings[0];
      expect(near(h.quantity, 0.000123), `quantity drifted: ${h.quantity}`);
      expect(near(h.purchasePrice, 12345.678901), `price drifted: ${h.purchasePrice}`);
      return `qty=${h.quantity}, price=${h.purchasePrice}`;
    });

    // ── 4. Ownership scoping (404-not-403) ────────────────────────────────
    await check('cross-user access is invisible (404 semantics)', async () => {
      const owner = await usersRepo.createUser({ name: 'O', email: `verify-own-${Date.now()}@example.com` });
      const attacker = await usersRepo.createUser({ name: 'X', email: `verify-atk-${Date.now()}@example.com` });
      const p = await portfoliosRepo.createPortfolio(owner.id, { name: 'Secret' });
      const w = await watchlistsRepo.createWatchlist(owner.id, 'SecretList');
      const c = await conversationsRepo.createConversation(owner.id, { title: 'Secret chat', chatType: 'main' });

      expect((await portfoliosRepo.getPortfolioById(attacker.id, p.id)) === null, 'portfolio leaked');
      expect((await portfoliosRepo.updatePortfolio(attacker.id, p.id, { name: 'Hacked' })) === null, 'portfolio update leaked');
      expect((await portfoliosRepo.deletePortfolio(attacker.id, p.id)) === false, 'portfolio delete leaked');
      expect((await watchlistsRepo.getWatchlistById(attacker.id, w.id)) === null, 'watchlist leaked');
      expect((await conversationsRepo.getConversationThread(attacker.id, c.id)) === null, 'conversation leaked');
      expect((await conversationsRepo.deleteConversation(attacker.id, c.id)) === false, 'conversation delete leaked');
      return 'all foreign lookups return null/false';
    });

    // ── 5. Position merge (weighted average) + update/delete by id ─────────
    await check('same-lot add merges with weighted-average cost', async () => {
      const u = await usersRepo.createUser({ name: 'M', email: `verify-merge-${Date.now()}@example.com` });
      const p = await portfoliosRepo.createPortfolio(u.id, { name: 'Merge' });
      await portfoliosRepo.addPosition(u.id, p.id, { symbol: 'WAC', assetType: 'stock', quantity: 10, purchasePrice: 100 });
      const merged = await portfoliosRepo.addPosition(u.id, p.id, { symbol: 'WAC', assetType: 'stock', quantity: 30, purchasePrice: 120 });
      expect(merged, 'addPosition returned null');
      expect(merged.holdings.length === 1, 'expected one merged lot');
      const h = merged.holdings[0];
      expect(near(h.quantity, 40), `quantity: ${h.quantity}`);
      // (10×100 + 30×120) / 40 = 115
      expect(near(h.purchasePrice, 115), `weighted avg: ${h.purchasePrice}`);
      return '10+30 @ (100,120) → 40 @ 115';
    });

    await check('position update/delete target the position UUID (no index API)', async () => {
      const u = await usersRepo.createUser({ name: 'U', email: `verify-pos-${Date.now()}@example.com` });
      const p = await portfoliosRepo.createPortfolio(u.id, { name: 'Pos' });
      await portfoliosRepo.addPosition(u.id, p.id, { symbol: 'AAA', assetType: 'stock', quantity: 1, purchasePrice: 10 });
      await portfoliosRepo.addPosition(u.id, p.id, { symbol: 'BBB', assetType: 'stock', quantity: 2, purchasePrice: 20 });
      const view = await portfoliosRepo.getPortfolioById(u.id, p.id);
      const target = view!.holdings.find((h) => h.symbol === 'AAA')!;

      const afterUpdate = await portfoliosRepo.updatePosition(u.id, p.id, target.id, { quantity: 5, purchasePrice: 11 });
      const a = afterUpdate!.holdings.find((h) => h.id === target.id)!;
      expect(near(a.quantity, 5) && near(a.purchasePrice, 11), 'update by positionId failed');

      const afterDelete = await portfoliosRepo.deletePosition(u.id, p.id, target.id);
      expect(afterDelete!.holdings.length === 1, 'delete by positionId failed');
      return 'id-addressed mutation OK';
    });

    // ── 6. Watchlist item upsert semantics ─────────────────────────────────
    await check('watchlist item re-add refreshes instead of duplicating', async () => {
      const u = await usersRepo.createUser({ name: 'W', email: `verify-wl-${Date.now()}@example.com` });
      const w = await watchlistsRepo.createWatchlist(u.id, 'Tech');
      await watchlistsRepo.addWatchlistItem(u.id, w.id, { symbol: 'AAPL', assetType: 'stock', notes: 'first' });
      const again = await watchlistsRepo.addWatchlistItem(u.id, w.id, { symbol: 'AAPL', assetType: 'stock', notes: 'second', alertPrice: 199.5 });
      expect(again, 'addWatchlistItem returned null');
      expect(again.assets.length === 1, `expected 1 item, got ${again.assets.length}`);
      expect(again.assets[0].notes === 'second', 're-add did not refresh notes');
      expect(again.assets[0].alertPrice === 199.5, 'alertPrice not refreshed');
      return 'single refreshed item';
    });

    // ── 7. Conversation message thread + retitle ───────────────────────────
    await check('messages persist in order; first user message retitles untitled conversation', async () => {
      const u = await usersRepo.createUser({ name: 'C', email: `verify-conv-${Date.now()}@example.com` });
      const c = await conversationsRepo.createConversation(u.id, { title: 'New conversation', chatType: 'main' });
      await conversationsRepo.appendMessage(u.id, c.id, { role: 'assistant', content: 'Hello!', provider: 'groq' });
      const afterUser = await conversationsRepo.appendMessage(u.id, c.id, { role: 'user', content: 'What is AAPL?', retitleIfUntitled: 'What is AAPL?' });
      expect(afterUser, 'appendMessage returned null');
      expect(afterUser.title === 'What is AAPL?', `title: ${afterUser.title}`);
      const thread = await conversationsRepo.getConversationThread(u.id, c.id);
      expect(thread!.messages.length === 2, 'message count');
      expect(thread!.messages[0].role === 'assistant' && thread!.messages[0].provider === 'groq', 'assistant message content/provenance');
      // A SECOND user message must NOT retitle again.
      const afterSecond = await conversationsRepo.appendMessage(u.id, c.id, { role: 'user', content: 'more', retitleIfUntitled: 'more' });
      expect(afterSecond!.title === 'What is AAPL?', 'retitle fired again on second message');
      return 'thread + one-shot retitle OK';
    });

    // ── 8. Password reset lifecycle (atomic consume) ───────────────────────
    await check('password reset: single outstanding token, consume once, invalid re-use', async () => {
      const u = await usersRepo.createUser({ name: 'R', email: `verify-rst-${Date.now()}@example.com`, passwordHash: 'old' });
      await authRepo.issuePasswordResetToken(u.id, 'hash-1', new Date(Date.now() + 3_600_000));
      await authRepo.issuePasswordResetToken(u.id, 'hash-2', new Date(Date.now() + 3_600_000));
      const active = await authRepo.getActiveResetToken(u.id);
      expect(active?.tokenHash === 'hash-2', 'older outstanding token not replaced');

      expect((await authRepo.consumePasswordResetToken('wrong', 'new')) === false, 'wrong hash consumed');
      expect((await authRepo.consumePasswordResetToken('hash-2', 'new-hash')) === true, 'valid token rejected');
      expect((await authRepo.consumePasswordResetToken('hash-2', 'again')) === false, 'used token replayed');
      const after = await usersRepo.getUserById(u.id);
      expect(after!.passwordHash === 'new-hash', 'password not updated atomically with consume');
      return 'token lifecycle OK';
    });

    // ── 9. Candle identity + canonical write policy ─────────────────────────
    await check('candles: identity unique, canonical upserts, non-canonical skips', async () => {
      const ts = new Date('2026-01-15T00:00:00.000Z');
      const row = { symbol: 'TEST', timestamp: ts, interval: '1day' as const, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1234.56, adjustmentMode: 'unknown' as const, sourceProvider: 'twelvedata' as const };
      expect((await candlesRepo.upsertCandle(row, false)) === 'inserted', 'first non-canonical insert');
      expect((await candlesRepo.upsertCandle(row, false)) === 'skippedNonCanonical', 'conflicting non-canonical overwrote');
      const canon = { ...row, close: 9.99, sourceProvider: 'eulerpool' as const };
      expect((await candlesRepo.upsertCandle(canon, true)) === 'upserted', 'canonical upsert failed');
      const read = await candlesRepo.readCandles({ symbol: 'TEST', from: new Date(0) });
      expect(read.length === 1, `identity not unique: ${read.length} rows`);
      expect(near(read[0].close, 9.99), 'canonical value did not win');
      expect(read[0].provider === 'eulerpool', 'provenance not updated');
      return 'single row, canonical wins';
    });

    // ── 10. Cascades ─────────────────────────────────────────────────────────
    await check('FK cascades clean up dependents (portfolio, watchlist, conversation)', async () => {
      const u = await usersRepo.createUser({ name: 'K', email: `verify-casc-${Date.now()}@example.com` });
      const p = await portfoliosRepo.createPortfolio(u.id, { name: 'Cascade' });
      await portfoliosRepo.addPosition(u.id, p.id, { symbol: 'C', assetType: 'stock', quantity: 1, purchasePrice: 1 });
      const w = await watchlistsRepo.createWatchlist(u.id, 'CascadeList');
      await watchlistsRepo.addWatchlistItem(u.id, w.id, { symbol: 'C', assetType: 'stock' });
      const c = await conversationsRepo.createConversation(u.id, { title: 'Cascade', chatType: 'main' });
      await conversationsRepo.appendMessage(u.id, c.id, { role: 'user', content: 'x' });

      await portfoliosRepo.deletePortfolio(u.id, p.id);
      await watchlistsRepo.deleteWatchlist(u.id, w.id);
      await conversationsRepo.deleteConversation(u.id, c.id);

      const pool = getPool();
      const { rows } = await pool.query(
        `select
           (select count(*) from positions where portfolio_id = $1) as pos,
           (select count(*) from watchlist_items where watchlist_id = $2) as wi,
           (select count(*) from messages where conversation_id = $3) as msg`,
        [p.id, w.id, c.id]
      );
      expect(Number(rows[0].pos) === 0 && Number(rows[0].wi) === 0 && Number(rows[0].msg) === 0, JSON.stringify(rows[0]));
      return 'positions/watchlist_items/messages cascade-deleted';
    });

    // ── 11. Flat lists: addToSet semantics ─────────────────────────────────
    await check('user watchlist symbols + tracked assets are set-like', async () => {
      const u = await usersRepo.createUser({ name: 'S', email: `verify-set-${Date.now()}@example.com` });
      await usersRepo.addUserWatchlistSymbol(u.id, 'AAPL');
      await usersRepo.addUserWatchlistSymbol(u.id, 'aapl'); // duplicate after uppercase
      let syms = await usersRepo.getUserWatchlistSymbols(u.id);
      expect(syms.filter((s) => s === 'AAPL').length === 1, `duplicate symbol stored: ${syms.join(',')}`);
      await usersRepo.removeUserWatchlistSymbol(u.id, 'AAPL');
      syms = await usersRepo.getUserWatchlistSymbols(u.id);
      expect(syms.length === 0, 'remove failed');

      await usersRepo.addUserTrackedAsset(u.id, { type: 'crypto', symbol: 'btc/usd' });
      const assets = await usersRepo.getUserTrackedAssets(u.id);
      expect(assets.length === 1 && assets[0].symbol === 'BTC/USD', 'tracked asset not normalized/stored');
      return 'idempotent add/remove OK';
    });

    // ── 12. Transactions ledger ────────────────────────────────────────────
    await check('transactions: ownership-gated create + reverse-chron list', async () => {
      const u = await usersRepo.createUser({ name: 'T', email: `verify-txn-${Date.now()}@example.com` });
      const p = await portfoliosRepo.createPortfolio(u.id, { name: 'Txn' });
      const t1 = await portfoliosRepo.createTransaction(u.id, p.id, { symbol: 'AAPL', assetType: 'stock', side: 'buy', quantity: 10, price: 150, fees: 1.5 });
      const t2 = await portfoliosRepo.createTransaction(u.id, p.id, { symbol: 'AAPL', assetType: 'stock', side: 'sell', quantity: 4, price: 160 });
      expect(t1 && t2, 'transaction create returned null');
      const list = await portfoliosRepo.getTransactions(u.id, p.id);
      expect(list!.length === 2 && list![0].id === t2!.id, 'ordering wrong');
      expect(near(list![0].fees, 0), 'default fees should be 0');
      return 'buy+sell rows, newest first';
    });
  } finally {
    await cleanup().catch(() => null);
  }

  console.log('\n' + '='.repeat(72));
  console.log(`Result: ${passed} passed, ${failed} failed`);
  return failed === 0 ? 0 : 1;
}

main()
  .then(async (code) => {
    const { closePool } = await import('@/lib/db/client');
    await closePool().catch(() => null);
    process.exit(code);
  })
  .catch(async (error) => {
    console.error('verify:postgres crashed:', error instanceof Error ? error.message : error);
    try {
      const { closePool } = await import('@/lib/db/client');
      await closePool();
    } catch {
      /* pool never opened */
    }
    process.exit(2);
  });
