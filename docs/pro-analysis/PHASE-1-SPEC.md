# Phase 1 Implementation Spec — Pro-Focused Draft Analysis

**Goal of Phase 1:** produce a `Dataset`-shaped object from *professional* match data, blended with the existing soloqueue data as a Bayesian prior, so that DraftGap's existing Elo engine, decomposition, and UI generate **pro-calibrated** draft predictions with **zero changes to the model**.

**Stack (hybrid):** Phase 1 is implemented entirely in **TypeScript** inside the existing monorepo, reusing `packages/core` and the `apps/dataset` pipeline. Python is deliberately deferred to Phase 2 (embeddings, factorization machines, sequence models), which will consume the same normalized pro match table / `Dataset` JSON produced here.

> Status: proposed. This document is the build plan; it does not itself change code.

---

## 1. Why this is cheap: the `Dataset` seam

Everything downstream of the `Dataset` interface is agnostic to where its numbers come from:

```
apps/dataset (build)  ──►  Dataset JSON (S3: datasets/v5/{name}.json)  ──►  packages/core (analyzeDraft)  ──►  frontend (useDataset)
```

`apps/dataset/src/index.ts` builds a `Dataset` from Lolalytics soloqueue data and calls `storeDataset(dataset, { name: "current-patch" })`. `packages/core/src/draft/analysis.ts` runs the Elo math on whatever `Dataset` it's handed. The frontend loads the JSON through `DatasetContext` / `useDataset`.

**Consequence:** Phase 1 introduces a *second producer* of the same `Dataset` shape. No changes to `packages/core`, and only a small additive change to the frontend (a data-source toggle).

The relevant target shape (already defined in the repo):

```ts
// packages/core/src/models/dataset/Dataset.ts
interface Dataset {
  version: string;
  date: string;
  championData: Record<string, ChampionData>;
  itemData; runeData; runePathData; statShardData; summonerSpellData; // Riot static — reused as-is
}

// ChampionData.statsByRole: Record<Role, ChampionRoleData>
interface ChampionRoleData {
  games: number;
  wins: number;                                        // ← we refill these from pro + prior
  matchup: Record<Role, Record<string, ChampionMatchupData>>;   // ally-role → enemyChampKey → {championKey, games, wins}
  synergy: Record<Role, Record<string, ChampionSynergyData>>;   // partner-role → partnerChampKey → {championKey, games, wins}
  damageProfile: ChampionDamageProfile;
  statsByTime: { wins: number; games: number }[];      // length 7
}
```

`Role` is the numeric enum `0..4` (top, jungle, mid, bot, support). Matchup/synergy leaf cells are `{ championKey, games, wins }`.

**The only cells Phase 1 recomputes are the win/game counts** (`wins`/`games` at the base, matchup, and synergy levels). Build data (items/runes/skills), `damageProfile`, and `statsByTime` are carried through from the soloqueue dataset unchanged — pro/soloq choice does not affect item stats, and pro sample sizes are far too small to build item/rune tables anyway.

---

## 2. Scope

**In scope (Phase 1)**
- Oracle's Elixir ingestion + normalization into a `ProMatch` table (TS).
- Aggregation of pro games into the `ChampionRoleData` win/game shape.
- Prior blending: pro estimates shrunk toward the existing soloqueue `Dataset` on the Elo/rating scale.
- A `buildProDataset()` producer + `pro-index.ts` entrypoint that writes `pro-current-patch.json`.
- A backtest harness (temporal split, log-loss/Brier/calibration) with baselines and a prior-strength sweep.
- A frontend data-source toggle (soloq ↔ pro).

**Out of scope (Phase 2+)**
- Side vs. pick-order features, ban modeling, flex handling, Fearless series state.
- Learned champion embeddings, factorization machines, the sequence/Transformer model.
- Any Python. Any change to the Elo math in `packages/core`.

---

## 3. New file tree

```
apps/dataset/src/pro/
  oracles-elixir.ts     # fetch + parse OE CSV → raw rows
  normalize.ts          # raw rows → ProMatch[] (typed, champion→key, position→Role)
  champion-map.ts       # OE champion name → Riot championKey (+ coverage assertion)
  aggregate.ts          # ProMatch[] → ProAggregate (wins/games: base, matchup, synergy)
  blend.ts              # blend(proCell, priorWinrate, k) on the rating scale
  build.ts              # buildProDataset(): assemble a full Dataset from pro + prior
  backtest.ts           # temporal split, metrics, baselines, k sweep
  types.ts              # ProMatch, ProAggregate, blend config
  __tests__/            # unit + integration tests + small CSV fixture
apps/dataset/src/
  pro-index.ts          # entrypoint (parallels index.ts): build + storeDataset("pro-current-patch")
```

Frontend (additive only):
```
apps/frontend/src/contexts/DatasetContext.tsx   # add source: "soloq" | "pro"; swap fetched JSON name
apps/frontend/src/components/...Settings         # a toggle bound to the above
```

No new files in `packages/core`. The blend helper reuses `winrateToRating`/`ratingToWinrate` from `packages/core/src/rating/ratings.ts`.

---

## 4. Data model (new)

```ts
// apps/dataset/src/pro/types.ts
export type ProMatch = {
  gameId: string;
  date: string;          // ISO
  patch: string;         // e.g. "14.13"
  league: string;        // LCK, LPL, LEC, LTA, ...
  bluePicks: ProPick[];  // exactly 5, ordered by draft pick order when available
  redPicks: ProPick[];
  blueBans: string[];    // championKeys, ordered (kept for Phase 2; unused in Phase 1 math)
  redBans: string[];
  winner: "blue" | "red";
};

export type ProPick = {
  championKey: string;   // mapped from OE champion name
  role: Role;            // 0..4, from OE position
};

// Aggregated counts, mirroring ChampionRoleData's numeric fields.
export type Counts = { wins: number; games: number };

export type ProAggregate = {
  // base[championKey][role] = Counts
  base: Record<string, Record<Role, Counts>>;
  // matchup[championKey][allyRole][enemyRole][enemyChampKey] = Counts
  matchup: Record<string, Record<Role, Record<Role, Record<string, Counts>>>>;
  // synergy[championKey][role][partnerRole][partnerChampKey] = Counts
  synergy: Record<string, Record<Role, Record<Role, Record<string, Counts>>>>;
};

export type BlendConfig = {
  priorGames: number;    // k — prior strength in pseudo-games (tuned by backtest; see §7)
  ratingScale: boolean;  // true = shrink in Elo/rating space; false = Beta-Binomial in winrate space
};
```

---

## 5. Function specs

### 5.1 Ingestion — `oracles-elixir.ts`

```ts
export async function fetchOraclesElixir(year: number): Promise<RawOeRow[]>;
```
- Downloads the OE year CSV (one file per year). Parse with a streaming CSV reader (e.g. `csv-parse`).
- OE emits ~12 rows per game: 10 player rows + 2 `position === "team"` rows. Draft-time columns we consume: `gameid`, `date`, `patch`, `league`, `side` (Blue/Red), `position` (top/jng/mid/bot/sup/team), `playername`, `teamname`, `champion`, `ban1..ban5`, `pick1..pick5` (populated on team rows), `result` (1/0).
- **Verify exact column names against the current OE Definitions page before coding** — treat the list above as the expected schema, not gospel.
- Ignore all in-game statistical columns (gold, kills, objectives, gamelength). See leakage check in §8.

### 5.2 Normalization — `normalize.ts` + `champion-map.ts`

```ts
export function normalize(rows: RawOeRow[], championMap: Map<string,string>): ProMatch[];
export function buildChampionMap(riotChampions: RiotChampion[]): Map<string, string>; // OE name → key
```
- Group rows by `gameid`; split into blue/red by `side`; read winner from a team row's `result`.
- Map `position` → `Role` (`top→0, jng→1, mid→2, bot→3, sup→4`).
- Map OE `champion` string → Riot `championKey` via `champion-map.ts`. This is the highest-risk mapping (naming drift: "Nunu & Willump", "Wukong/MonkeyKing", "Renata Glasc"). The map is built from the Riot static champion list (reuse `apps/dataset/src/riot.ts::getChampions`) plus a small hardcoded alias table.
- **Assertion:** every champion string in the corpus maps to a known key, or the build fails loudly (prevents silent data loss).
- Pick order: use team-row `pick1..pick5` to order `bluePicks`/`redPicks`. If unavailable for a game, fall back to role order and flag the game (`orderKnown: false`) — Phase 1 math ignores order, so this is non-blocking.

### 5.3 Aggregation — `aggregate.ts`

```ts
export function aggregateProGames(matches: ProMatch[], filter: PatchFilter): ProAggregate;
```
Mirror exactly what `apps/dataset/src/lolalytics/index.ts` builds, but by counting real games:
- **Base:** for each pick, `base[champ][role].games++`, `.wins += (thatSideWon ? 1 : 0)`.
- **Matchup:** for each ally pick vs each enemy pick, `matchup[allyChamp][allyRole][enemyRole][enemyChamp]` += game/win. (Directional; `analyzeMatchups` already averages a matchup with its mirror.)
- **Synergy:** for each unordered pair within a team, record under both champions' `synergy[champ][role][partnerRole][partnerChamp]`.
- `filter` selects a **patch window** (e.g. current patch, else last N patches with the most games) — pro data per single patch is thin, so pooling a small window is expected; record it in `Dataset.version`/`date`.

### 5.4 Blending — `blend.ts`

The heart of Phase 1. For every cell, combine the sparse pro count with the soloqueue rate as a prior. This reuses the mechanism already in `analyzeChampion` (adding `priorGames` pseudo-games at a prior win rate) — we simply supply the **soloqueue rate for that exact cell** as the prior mean.

```ts
import { ratingToWinrate, winrateToRating } from "@draftgap/core/src/rating/ratings";

export function blendCell(pro: Counts, priorWinrate: number, cfg: BlendConfig): Counts {
  const k = cfg.priorGames;
  if (!cfg.ratingScale) {
    // Beta-Binomial: k pseudo-games at the prior winrate.
    return { wins: pro.wins + k * priorWinrate, games: pro.games + k };
  }
  // Rating-space shrinkage (preferred): precision-weighted blend of Elo ratings,
  // then re-express as wins/games on the pro sample size so downstream code is unchanged.
  const proWr = pro.games > 0 ? pro.wins / pro.games : priorWinrate;
  const rPrior = winrateToRating(clamp(priorWinrate));
  const rPro   = winrateToRating(clamp(proWr));
  const wPro   = pro.games / (pro.games + k);
  const blendedWr = ratingToWinrate(wPro * rPro + (1 - wPro) * rPrior);
  const games = pro.games + k;                 // effective sample size
  return { wins: blendedWr * games, games };
}
```
- `priorWinrate` comes from the **existing soloqueue `Dataset`** (loaded via `getDataset({ name: "current-patch" })`) for the same champion/role/matchup/synergy cell. If the prior cell is empty, fall back to the champion-role base rate, then to 0.5.
- `k` (prior strength) is the single most important tunable and is **independent of the user-facing risk level** (`priorGamesByRiskLevel`, 250–3000, still governs runtime matchup/duo trust in `analyzeDraft`). Because pro cells hold tens of games, expect `k` on the order of tens-to-low-hundreds; final value chosen by the §7 sweep.
- Base, matchup, and synergy cells are all blended the same way. Deltas are still computed later by `analyzeDraft` — we only supply better raw counts.

### 5.5 Assembly — `build.ts` + `pro-index.ts`

```ts
export async function buildProDataset(opts: { patchWindow?: number; blend: BlendConfig }): Promise<Dataset>;
```
Orchestration:
1. Riot static (reuse `riot.ts`): champions, runes, items, summoner spells → the non-stats fields of `Dataset` (identical to `index.ts`).
2. Load the soloqueue `Dataset` prior: `getDataset({ name: "current-patch" })` (and `"30-days"` as a secondary prior source).
3. `fetchOraclesElixir` → `normalize` → `aggregateProGames`.
4. For each champion/role, construct `ChampionRoleData` starting from `defaultChampionRoleData()`, then set `wins/games`, `matchup`, `synergy` via `blendCell(...)` against the prior; carry `damageProfile` and `statsByTime` from the soloq prior.
5. Run `removeRankBias(dataset)` (from `Dataset.ts`) so base rates are centered exactly as the soloq pipeline does.
6. Return the `Dataset`.

`pro-index.ts` mirrors `index.ts`:
```ts
const proDataset = await buildProDataset({ blend: { priorGames: K, ratingScale: true } });
await storeDataset(proDataset, { name: "pro-current-patch" });
```

### 5.6 Frontend toggle

- Extend `DatasetContext` with `source: "soloq" | "pro"` (default `"soloq"`), swapping the fetched object name (`current-patch` ↔ `pro-current-patch`).
- Add a settings toggle bound to it. Everything else (`analyzeDraft`, decomposition tables, scaling chart) is unchanged because the shape is identical. Build tabs continue to read the carried-through soloq build data.

---

## 6. Blending math (reference)

For a cell with pro counts `(wᵖ, nᵖ)` and soloqueue prior win rate `q`:

**Beta-Binomial (simple):**
```
w' = wᵖ + k·q      n' = nᵖ + k        winrate' = w'/n'
```

**Rating-space (preferred):** with `r(x) = −400·log₁₀(1/x − 1)`, its inverse `r⁻¹`, and weight `α = nᵖ/(nᵖ+k)`:
```
winrate' = r⁻¹( α·r(wᵖ/nᵖ) + (1−α)·r(q) )
```
Both reduce to the prior when `nᵖ = 0` and to the pro estimate as `nᵖ → ∞`. The rating-space form is consistent with how `packages/core` already reasons about win rates (additive in log-odds), and with `removeRankBias`, which likewise shifts win rates in rating space.

---

## 7. Backtest harness — `backtest.ts`

```ts
export async function backtest(cfg: { splitDate: string; kGrid: number[] }): Promise<BacktestReport>;
```
- **Temporal split:** train the blend (aggregate pro games) on matches with `date < splitDate`; evaluate on `date ≥ splitDate`. Never shuffle across time.
- **Prediction:** for each held-out game, build the two teams' role→champ maps and call `analyzeDraft` on the candidate `Dataset`; take `winrate` as P(blue win).
- **Metrics:** accuracy, **log-loss**, Brier score, and a 10-bin reliability/calibration curve. Log-loss is the primary gate.
- **Baselines to beat (in order):**
  1. Base rate — historical blue-side win %.
  2. Pure soloqueue Elo — the current `current-patch.json` through `analyzeDraft`.
  3. Pro-only — aggregate with `k = 0` (no prior); demonstrates the sparse-data failure mode.
  4. **Blended** — the Phase 1 model.
- **Tuning:** sweep `k` over `kGrid` (e.g. `[0, 25, 50, 100, 200, 400]`) by cross-validated held-out log-loss; select the minimizer.
- **Report:** a table of {model, k} → {accuracy, log-loss, Brier, calibration error}, plus per-league and per-patch breakdowns.

**Success gate for Phase 1:** blended beats both pure-soloq and pro-only on held-out log-loss, and is better-calibrated than pure-soloq (soloq is expected to be systematically miscalibrated for pro — the whole premise).

---

## 8. Test plan

**Unit**
- CSV parse against a committed small fixture (2–3 games) → exact `RawOeRow[]`.
- `buildChampionMap` covers every champion in the fixture and in the live Riot list; alias cases (Wukong, Nunu & Willump, Renata) resolve.
- `aggregateProGames` on a hand-computed fixture → exact `base/matchup/synergy` counts.
- `blendCell` edge cases: `nᵖ=0 ⇒ winrate=q`; `k=0 ⇒ pure pro`; monotonic in `nᵖ`; clamped away from 0/1 to avoid `±∞` ratings.

**Integration**
- `buildProDataset` on one patch window → valid `Dataset`: all five `Role` keys present per champion, no `NaN`/`Infinity`, `games ≥ wins ≥ 0`, JSON round-trips.
- The produced JSON loads through `getDataset` and runs end-to-end through `analyzeDraft` without throwing.

**Leakage check (mandatory)**
- Assert the feature set reaching the model is strictly draft-time: champion, role, side, patch. A test greps the pro pipeline for forbidden OE columns (gold, kills, objectives, gamelength) to guarantee none feed the aggregate.

**Regression**
- Golden-file test on the backtest report for a fixed split so metric changes are visible in review.

---

## 9. Milestones (ordered, each independently shippable)

| # | Milestone | Output | Test gate |
|---|-----------|--------|-----------|
| M1 | OE ingestion + normalization + champion map | `ProMatch[]` from a real year file | parse + mapping coverage tests pass |
| M2 | Aggregation to `ChampionRoleData` shape | `ProAggregate` | hand-computed fixture matches |
| M3 | Prior blending vs existing soloq `Dataset` | `blendCell` + wired build | blend edge-case tests pass |
| M4 | `buildProDataset` + `pro-index.ts` | `pro-current-patch.json` in S3 | valid-Dataset integration test |
| M5 | Backtest harness + baselines + `k` sweep | metrics report | blended beats baselines on log-loss |
| M6 | Frontend data-source toggle | soloq/pro switch in UI | manual + snapshot test |
| M7 | Scheduled job + docs | 12h refresh like existing | runs green in CI/cron |

---

## 10. Risks & decisions to flag

- **Champion-name mapping drift** — new champions/renames break ingestion. Mitigation: hard-fail on unmapped names + alias table + a coverage test against the live Riot list.
- **Patch sparsity** — a single pro patch may have too few games. Decision: pool a small patch window with recency weighting; record the window in the dataset metadata.
- **Empty matchup/synergy cells** — most specific pro pairings have 0 games and will simply equal the prior. That is correct and expected in Phase 1; richer handling is Phase 2 (embeddings).
- **Side base-rate ≠ 50%** — blue side wins >50% in pro. `removeRankBias` centers per-champion rates; the backtest's base-rate baseline must use the *actual* blue win rate, and side handling proper is Phase 2 (First Selection decoupled side/pick-order).
- **Prior contamination** — the soloq prior is itself biased; `k` too high just reproduces soloq. The `k` sweep + calibration gate guard against this.
- **Oracle's Elixir attribution/licensing** — free for public use with credit; add attribution in-app and in docs, and be mindful of any commercial-use terms.

---

## 11. Definition of Done (Phase 1)

1. `pnpm --filter dataset pro` builds `pro-current-patch.json` from live Oracle's Elixir data.
2. The pro dataset loads in the app via the source toggle and produces predictions + the existing decomposition, unchanged.
3. The backtest shows blended > pure-soloq and > pro-only on held-out log-loss, with a calibration curve at least as good as soloq, on a documented temporal split.
4. All unit/integration/leakage tests pass; the job is scheduled on the existing cadence.

---

## 12. Hybrid boundary — where Python enters (Phase 2)

Phase 1 stays in TypeScript to reuse the Elo engine and ship end-to-end fast. The clean handoff to Python later is the **normalized `ProMatch` table** and the **`Dataset` JSON**: a Python service (pandas + PyTorch) reads the same `ProMatch` export to train champion embeddings, factorization machines, and the sequence/Transformer model, and can either (a) emit the same `Dataset` JSON (drop-in, as here) or (b) serve richer per-action predictions behind a new interface once the Elo shape is outgrown. Nothing in Phase 1 blocks that — the seam is already JSON.
