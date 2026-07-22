# How Vantage Turns Data Into Draft Predictions

*A detailed walkthrough of Vantage's two data pipelines — soloqueue (lolalytics) and professional (Oracle's Elixir) — and the shared mathematical model behind the win‑probability numbers, with an honest accounting of strengths and weaknesses.*

---

## TL;DR

Vantage does **not** train a machine‑learning model. It is a transparent, deterministic **Elo‑style additive rating system**. The same engine runs over **two interchangeable data sources**, switchable from Settings:

- **Soloqueue mode** (default) — aggregate statistics scraped from **lolalytics.com** (Emerald+, all regions, ranked). This is the source Parts 1–9 document in detail.
- **Pro mode** — a **professional dataset Vantage builds itself** from raw Oracle's Elixir match records, blended onto the soloqueue prior. Fully documented in **Part 10**.

Both are first‑class. The prediction maths (Parts 3–5) is shared; only the inputs and how they're prepared differ.

The whole engine can be summarised in one line:

```
totalRating =  Σ ally champion ratings
             + Σ ally synergy residuals
             + Σ cross‑team matchup residuals
             − Σ enemy champion ratings
             − Σ enemy synergy residuals

winrate = 1 / (1 + 10^(−totalRating / 400))
```

Every term is a winrate that has been (a) recentred so the *average champion sits at 50%*, (b) shrunk toward a sensible prior to tame small samples, and (c) converted to the Elo rating scale so the terms can be **added** instead of naively multiplied. Matchups and synergies contribute only the part of their winrate that isn't already explained by the two champions' individual strength, which stops the model from double‑counting.

---

## Part 1 — The data source: lolalytics

### 1.1 What is fetched

The data build lives in `apps/dataset`. For **every champion, in every role**, it makes two requests to lolalytics:

| Purpose | Function | Endpoint |
|---|---|---|
| Base stats, matchups, timings, damage | `getLolalyticsQwikChampion` (`apps/dataset/src/lolalytics/qwik.ts`) | `https://lolalytics.com/lol/{champion}/build/?…` (HTML page) |
| Synergy / duo stats | `getLolalyticsQwikChampion2` (`.../qwik-champion2.ts`) | `https://a1.lolalytics.com/mega/?ep=build-team&…` (JSON API) |

The first endpoint returns a **rendered HTML page**, not an API payload. The build reaches into a `<script type="qwik/json">` blob embedded by lolalytics' Qwik frontend, then *de‑references the Qwik object graph* (`parseObj`, base‑36 index pointers) to reconstruct a normal JSON object (`QwikLolalyticsData`). This is effectively controlled scraping of lolalytics' own hydration data — powerful, but brittle: a change to how lolalytics ships that blob breaks ingestion.

### 1.2 The population the numbers describe

Both endpoints pin the population filters (see `qwik.ts` / `qwik-champion2.ts`):

```
tier   = emerald_plus     # Emerald rank and above          (both endpoints)
region = all              # every server pooled              (both endpoints)
queue  = ranked           # ranked solo/duo                  (synergy endpoint explicitly;
                          #                                   the build page defaults to ranked)
```

The base build endpoint pins `tier` + `region` (+ `patch`, and `lane` when a specific role is requested); lolalytics' build page is ranked soloqueue by default. The synergy endpoint additionally sends `queue = ranked` explicitly.

**This is the single most important fact about the model.** Every prediction is ultimately a statement about *how these champions have historically performed in Emerald+ ranked soloqueue, pooled across all regions*. It is **not** pro play, not low elo, not a specific patch's competitive meta.

### 1.3 Two snapshots per build

`apps/dataset/src/index.ts` builds two datasets on each run:

- **`current-patch`** — `version` = the live patch (from Riot's Data Dragon version list). Fresh, small, reacts fast to balance changes.
- **`30-days`** — a rolling 30‑day window (`version = "30"`). Much larger and more stable.

Champion/item/rune/spell identity comes from Riot's Data Dragon (`riot.ts`), not lolalytics. A few identity quirks are patched in code (`monkeyking → wukong`, `Fiddlesticks` casing).

---

## Part 2 — From raw stats to the `Dataset`

### 2.1 Per champion‑role transformation

For each champion‑role, lolalytics gives a reported win **rate** and a sample size `n`. The build reconstructs a win **count** and packs everything into `ChampionRoleData` (`apps/dataset/src/lolalytics/index.ts`):

```
games = header.n
wins  = round(n · wr / 100)          # rebuild wins from a rounded winrate
```

- **matchup**: for each enemy role, an array of `[enemyKey, winRate, …, games]` → `{ championKey, games, wins: games · wr/100 }`.
- **synergy**: same shape, from the champion2 "team" arrays, per teammate role.
- **damageProfile**: `header.damage` (physical / magic / true) — **display only**, not used in the prediction.
- **statsByTime**: game‑length buckets folded from lolalytics' time bins — used only by a separate "rating over time" view, **not** the main prediction.

### 2.2 Two dataset‑wide clean‑ups

**(a) `removeRankBias(dataset)`** — `packages/core/src/models/dataset/Dataset.ts`

The pooled winrate across *all* champion‑role cells is not exactly 50% (rounding, remakes, the Emerald+ filter, and the fact that lolalytics matchup samples span all ranks all nudge it). The model wants ratings to mean "relative to an average champion", so it recentres the entire dataset on the Elo scale:

```
rankWR     = totalWins / totalGames                       # pooled over every cell
rankRating = winrateToRating(rankWR)
newWins    = ratingToWinrate( winrateToRating(cellWR) − rankRating ) · games
```

Applied to base, matchup, synergy, and time cells. After this, the *average* champion sits at rating 0 ≈ 50%, and a champion's rating reads as "how much better/worse than average".

**(b) `deleteDatasetMatchupSynergyData(current‑patch)`**

The current‑patch dataset **throws away its matchup and synergy tables** — on a fresh patch they are far too thin to trust. Consequence, visible all through `analysis.ts`:

> **Base champion winrates come from the *current patch*. All matchups and synergies come from the *30‑day* window.**

This is why every analysis function receives both a `dataset` (current) and a `fullDataset` / `synergyMatchupDataset` (30‑day).

---

## Part 3 — The rating scale (why Elo)

`packages/core/src/rating/ratings.ts`:

```
ratingToWinrate(d) = 1 / (1 + 10^(−d / 400))      # rating → probability
winrateToRating(w) = −400 · log10(1/w − 1)         # probability → rating
```

This is the **logistic / Elo** curve. Rating `0` = 50%; `+400` ≈ 10× the odds. The point of moving to this scale is that **winrates don't add, but log‑odds do.** If champion A is 55% and champion B is 55%, the team isn't 110% — but their *ratings* can be summed and mapped back through the logistic once at the very end. Everything in the model is converted to ratings, combined additively, and converted back a single time.

---

## Part 4 — The additive draft model

The master function is `analyzeDraft` (`packages/core/src/draft/analysis.ts`). It computes five sub‑ratings and combines them:

```
totalRating = allyChampionRating          # sum of ally base ratings
            + allyDuoRating               # sum of ally synergy residuals
            + matchupRating               # sum of cross‑team matchup residuals
            − enemyChampionRating
            − enemyDuoRating

winrate = ratingToWinrate(totalRating)
```

### 4.1 Champion base rating + Bayesian shrinkage (`analyzeChampion`)

For each champion‑role:

```
k          = priorGames                      # prior strength, from Risk Level
WR_30d     = champion's 30‑day winrate in this role   # the prior mean
smoothedWR = (wins_patch + k · WR_30d) / (games_patch + k)
rating     = winrateToRating(smoothedWR)
```

This is **empirical‑Bayes / additive smoothing**. A thin current‑patch sample is pulled toward the champion's *own* longer‑term form — **not** toward a flat 50% — so the estimate stays stable early in a patch without erasing the champion's identity.

`priorGames` is set by the **Risk Level** the user picks (`packages/core/src/risk/risk-level.ts`):

| Risk | prior `k` (games) | Behaviour |
|---|---|---|
| Very Low | 3000 | Heavy prior — trusts the 30‑day form, ignores patch noise |
| Low | 2000 | |
| Medium | 1000 | Default balance |
| High | 500 | |
| Very High | 250 | Light prior — trusts the small current‑patch sample |

So Risk Level is literally the **bias/variance dial** of the shrinkage.

> Toggling **"ignore individual champion winrates"** sets both `allyChampionRating` and `enemyChampionRating` to `0`, leaving only matchups and synergies. (This is why, with the toggle on, everything reads near 50% until an interaction term moves it.)

### 4.2 Matchups — residualised and symmetrised (`analyzeMatchups`)

For every ally × enemy pair (up to 25 pairings), the model asks: *do these two beat each other by more than their individual strengths already predict?*

```
expected = winrateToRating(WR_ally) − winrateToRating(WR_enemy)   # solo‑strength gap

# Symmetrise the head‑to‑head using BOTH champions' pages:
w = ( allyVsEnemy.wins + (enemyVsAlly.games − enemyVsAlly.wins) ) / 2
n = ( allyVsEnemy.games + enemyVsAlly.games ) / 2

shrunkWR      = (w + k · ratingToWinrate(expected)) / (n + k)   # shrink toward "expected"
matchupRating = winrateToRating(shrunkWR) − expected            # RESIDUAL only
```

Two design choices matter here:

1. **Symmetrisation.** The same head‑to‑head is recorded on both champions' pages; averaging the two directions doubles the effective sample and cancels page‑specific bias.
2. **Residualisation** (`− expected`). The matchup contributes *only the part not explained by the champions' base winrates*. Champion strength is already counted once in Part 4.1; the matchup adds only the interaction. This is what stops the model double‑counting a strong champion.

The shrinkage prior for a matchup is `expected` itself — with little data, the model assumes "these two perform exactly as their solo strengths suggest" (zero residual).

### 4.3 Synergies / duos (`analyzeDuos`)

For each same‑team pair (up to 10):

```
expected  = winrateToRating(WR_A) + winrateToRating(WR_B)   # note: ADD (same side)
(w, n)    = averageStats(A_with_B, B_with_A)                # symmetrised
shrunkWR  = (w + k · ratingToWinrate(expected)) / (n + k)
duoRating = winrateToRating(shrunkWR) − expected            # residual synergy
```

Same idea as matchups, mirrored for teammates: only the **residual synergy** beyond the two champions' individual strength is added.

### 4.4 Putting it together

Ally base + ally synergy residuals + matchup residuals, minus the enemy's base and synergy, gives one `totalRating`; a single logistic converts it to the win probability shown in the sidebar. Because matchups and synergies are residuals, the components are (approximately) non‑overlapping contributions.

---

## Part 5 — Calibrated uncertainty (the ± figure)

Each cell that feeds the sum also contributes an **information term** — the inverse sampling variance of a smoothed winrate (`infoTerm` in `analysis.ts`):

```
info_cell = 1 / ( p(1−p) · max(effectiveGames, ε) )
totalInfo = Σ info_cell                               # over base + matchup + duo cells
winrateStdError = winrate · (1 − winrate) · sqrt(totalInfo)
```

`effectiveGames` is the **post‑shrinkage** sample (`games + k`), so a prediction backed by lots of real games gets a tight ±, and one propped up mostly by the prior gets a wide one. This is what surfaces the small "± x.x" next to the win probability and lets the UI flag thin, low‑trust predictions.

---

## Part 6 — Champion suggestions & the min‑games filter

`getSuggestions` (`packages/core/src/draft/suggestions.ts`) tries every unpicked champion in every open role, runs the full `analyzeDraft`, and sorts by predicted winrate. A sample‑size filter keeps the list sane:

```
# soloq (default): scale a 30‑day count down to a ~7‑day estimate
filterGames = (rawGames / 30) · 7
# pro: compare the true sample directly (rawGames − prior k)
if (!forceInclude && filterGames < minGames) skip
```

`alwaysIncludeChampions` bypasses the filter — this is the hook that lets an explicitly **searched‑for off‑meta pick** (e.g. Urgot support) appear even though the filter would normally hide it.

---

## Part 7 — A worked sketch (illustrative numbers)

Suppose, after recentring and shrinkage:

- Ally base ratings sum to **+30** (a slightly above‑average roster).
- Ally synergy residuals sum to **+8** (comp fits together a little).
- Cross‑team matchup residuals sum to **+12** (favourable lanes overall).
- Enemy base ratings sum to **+10**, enemy synergy residuals **+4**.

```
totalRating = 30 + 8 + 12 − 10 − 4 = 36
winrate     = 1 / (1 + 10^(−36/400)) ≈ 0.552  → 55.2%
```

If most of those matchup cells were thin, `totalInfo` is large, and you might see something like **55.2% ± 3.1**; the same point estimate on deep samples might read **55.2% ± 0.6**.

*(Numbers are illustrative, chosen to show the mechanics.)*

---

## Part 8 — Strengths

1. **Mathematically sound additivity.** Working in Elo/log‑odds and converting once at the end is the correct way to combine independent probabilistic effects; it avoids the classic "just add/multiply winrates" mistake.
2. **No double‑counting.** Residualising matchups and synergies against base strength means each champion's raw quality is counted exactly once, and interactions add only what's genuinely interactive. This is the model's most elegant idea.
3. **Shrinkage toward the right prior.** Pulling thin current‑patch data toward the champion's *own* 30‑day form (not a flat 50%) stabilises early‑patch estimates while preserving champion identity. Exposing the prior strength as "Risk Level" hands the bias/variance tradeoff to the user.
4. **Sample‑doubling symmetry.** Reading each matchup/duo from both champions' pages roughly doubles the effective sample and cancels one‑sided bias.
5. **Interpretable recentring.** `removeRankBias` makes every rating mean "vs an average champion", independent of the sample's absolute baseline.
6. **Honest uncertainty.** The ± is derived from real per‑cell sample sizes, so low‑trust predictions are visible rather than hidden behind a confident‑looking percentage.
7. **Transparent, fast, cheap.** Deterministic, fully explainable cell‑by‑cell, no training, no inference server — it runs instantly client‑side and can always tell you *why* a number is what it is.

---

## Part 9 — Weaknesses & limitations

1. **Wrong population for pro analysis.** The data is **Emerald+ ranked soloqueue, all regions**. It contains no bans, no coordinated play, no side/first‑pick selection, no fearless draft. Using it to predict *professional* games is a genuine domain mismatch — this is exactly what Vantage's **pro mode (Part 10)** addresses by swapping in professional data.
2. **Only pairwise interactions.** The model captures base + 2‑body matchups + 2‑body synergies. It has **no 3+ body / whole‑composition** understanding — engage+peel+frontline stacking, wombo‑combo ults, global presence, poke‑vs‑dive identities. Real comps are more than the sum of their pairs.
3. **Independence is assumed but false.** Summing ratings — and, more sharply, summing `infoTerm`s to get variance — assumes the components are independent. They aren't: the same games underlie a champion's base, matchup, and synergy cells, and lane matchups correlate. The point estimate can be mildly biased, and the **± is likely an under‑estimate** (positive correlation + a delta‑method approximation).
4. **Interactions always lag the patch.** Because current‑patch matchup/synergy tables are deleted, *every* interaction term comes from the 30‑day window even when the new patch fundamentally changed a matchup. Base winrates react fast; residuals do not.
5. **Cross‑rank matchup contamination.** A code comment notes lolalytics matchup stats are "vs champions of every rank, not just the rank of the player", and the intended correction (`distributeMatchupWinrates`) is **commented out**. So matchup samples mix ranks in a way that isn't fully consistent with the Emerald+ base.
6. **Global, uniform bias removal.** `removeRankBias` subtracts one dataset‑wide Elo offset for everyone. Champions that specifically over‑ or under‑perform at Emerald+ (elo‑dependent skill curves) aren't individually corrected.
7. **Reconstruction & rounding error.** `wins = round(n · wr/100)` is built from an already‑rounded winrate; small cells accumulate quantisation error that the shrinkage only partly masks.
8. **Rich signals left on the table.** `damageProfile` and `statsByTime` are ingested but **don't feed the win prediction** (they power a damage bar and a separate time‑curve view). Damage identity and scaling could improve comp‑level modelling but currently don't.
9. **No game‑specific context.** No opponent bans, no draft order/tempo, no player champion mastery, no counter‑pick sequencing, no patch‑trend extrapolation. It answers "how did these 10 champions in these roles historically fare", not "who wins *this* game between *these* players".
10. **Selection / survivorship bias.** Soloqueue winrates are conditional on the champion being picked (often blind‑ or counter‑picked); that selection context differs from a deliberately drafted game, which subtly biases every base and interaction number.
11. **Scraping fragility.** Ingestion depends on lolalytics' Qwik hydration blob and undocumented endpoints; there is no contract, so upstream UI changes can silently break or distort the data.

---

## Part 10 — The professional dataset (pro mode)

Vantage's second data source. A **Data source** toggle in Settings ("Soloqueue / Pro") swaps the entire dataset the engine reads. The rating maths of Parts 3–5 is **identical**; what differs is the input and how it's prepared. Where soloqueue data is *scraped winrate aggregates*, the pro dataset is **built by Vantage itself** from raw professional match records (`apps/dataset/src/pro/*`).

### 10.1 Source — Oracle's Elixir

Oracle's Elixir publishes a per‑game CSV of professional matches (yearly files; the download URL changes each season, so it is supplied via `OE_CSV_URL` rather than hardcoded — `oracles-elixir.ts`).

Vantage consumes **only draft‑time columns**: `gameid, datacompleteness, date, patch, league, side, position, champion, result, ban1..5, pick1..5`. It deliberately ignores gold, kills, objectives and game length, so **no in‑game signal can leak** into what is meant to be a draft‑phase prediction. This is a hard boundary set at the ingestion layer.

### 10.2 Normalise — raw rows → clean matches (`normalize.ts`)

Oracle's Elixir emits ~12 rows per game (5 player rows + 1 team‑summary row per side). Normalisation:

- groups rows by `gameid`;
- keeps only games where `datacompleteness === "complete"`;
- requires exactly **5 blue + 5 red** player rows (else the game is dropped);
- resolves the winner from `result`;
- maps each champion display name → Riot `championKey` (`champion-map.ts`) and each OE position (`top/jng/mid/bot/sup`) → `Role` `0..4` (`positions.ts`);
- reads pick order from the team row's `pick1..5`, **falling back** to deterministic role order and flagging `orderKnown = false` when pick columns are missing;
- reads bans;
- emits a `ProMatch { gameId, date, patch, league, bluePicks, redPicks, blueBans, redBans, winner, orderKnown }`.

Every dropped game is tallied by reason (`incomplete / wrong_player_count / no_winner / unmapped_champion / error`), so ingestion quality is auditable rather than silent. Patches are shortened `14.13.1 → 14.13`.

### 10.3 Aggregate — matches → win/game counts (`aggregate.ts`)

Aggregation mirrors the soloqueue builder exactly, so the resulting tables are drop‑in compatible with the engine:

- **base** — one win/games tally per champion‑role;
- **matchup** — each ally champion vs each enemy champion, from the ally's perspective (25 ordered pairs per team per game);
- **synergy** — every within‑team pair, recorded from **both** champions' perspectives.

Each game increments `games` on both sides and `wins` only on the winning side, so the counts are symmetric — precisely the shape `analyzeMatchups` / `analyzeDuos` already consume (Part 4).

### 10.4 Blend — shrink sparse pro data onto the soloqueue prior (`blend.ts`)

Pro samples are tiny (hundreds of games, not millions). A raw pro winrate for one champion — let alone one specific matchup — is far too noisy to trust. Each pro cell is therefore shrunk toward the corresponding **soloqueue** winrate, on the Elo scale (consistent with the rest of the engine):

```
alpha     = proGames / (proGames + k)                       # weight on the pro sample
blendedR  = alpha · winrateToRating(proWR)
          + (1 − alpha) · winrateToRating(priorWR)          # precision‑weighted in rating space
blendedWR = ratingToWinrate(blendedR)
effective = { games: proGames + k,  wins: blendedWR · (proGames + k) }
```

- **`k`** (prior strength, in pseudo‑games) is the blend's tuning knob: high `k` trusts soloqueue, low `k` trusts the sparse pro sample. Default **100**, chosen by the backtest (10.6). It is recorded in `proMeta` and is **independent of the user‑facing Risk Level** (Part 4.1).
- Limits behave correctly: pro games `= 0` → pure prior; `k = 0` → pure pro; pro games `→ ∞` → pure pro.
- Output is expressed as effective `{wins, games}` on `proGames + k`, so **`analyzeDraft` runs unchanged** — it never knows it's looking at blended data.
- A Beta‑Binomial mode (add `k` pseudo‑games at the prior winrate, in raw winrate space) exists as an alternative; the rating‑scale blend is the one used.
- Prior readers fall back gracefully: an unobserved matchup falls back to the ally's base winrate, synergy to the champion's base winrate, base to `0.5`.

### 10.5 Build — overlay onto a cloned prior (`build.ts`, `pro-index.ts`)

`buildProDataset` starts from the soloqueue **current‑patch** dataset (the prior), deep‑clones it, then:

- blends every champion‑role **base** winrate;
- **overwrites** each matchup/synergy cell that was actually observed in pro (blended as in 10.4);
- carries everything else — unobserved interactions, damage profiles, timings, and all item/rune/spell tables — straight through the clone.

`pro-index.ts` then attaches `proMeta` (match count, patches, leagues, `builtAt`, `k`) and applies **`removeRankBias`** exactly as the soloqueue pipeline does (Part 2.2), before storing the result as `pro-current-patch`.

> **Consequence worth understanding.** Because the prior is the *current‑patch* soloqueue snapshot — whose matchup/synergy tables were stripped in Part 2.2 — pro‑mode interaction cells exist **only where pro games were observed**, and their shrinkage prior is the champion's soloqueue *base* winrate, not a soloqueue matchup winrate. Wherever pro has no data, the prediction gracefully degrades to base ratings plus the "expected" (zero‑residual) matchup — i.e. pure champion strength. (This is also why cell lookups must tolerate missing interaction tables — see the optional‑chaining guards in `utils.ts`.)

### 10.6 Backtest — is the blend actually better, and which `k`? (`backtest.ts`)

`k` is not guessed; it's chosen by a **temporal backtest**. Matches before a split date train the blend; matches on/after it are held out for scoring. Three models are compared on the held‑out set:

- **base‑rate** — a constant blue‑side win rate taken from training;
- **soloq** — the soloqueue prior alone, no pro blend;
- **blended(k)** — pro blended onto the prior, swept across a grid of `k`.

Scoring uses proper rules — **log‑loss**, **Brier**, **accuracy**, and **ECE** (10‑bin calibration error) — and `bestBlended` picks the `k` with the lowest held‑out log‑loss. An honest limitation is written into the code: `analyzeDraft` is **side‑agnostic**, so it captures champion/matchup/synergy value but **not** blue‑side advantage — only the base‑rate baseline captures that structural edge.

### 10.7 Pro mode at runtime (`DatasetContext`, `DraftAnalysisContext`)

When the toggle is flipped:

- both the "current" and "30‑day" dataset slots point at the single `pro-current-patch.json` (bundled same‑origin);
- the suggestion filter switches to `scaleGamesToWeek: false` with `gamesOffset: k`, so it compares the **true** pro sample (`blended − k`) against `proMinGames` (default **20**) instead of scaling a 30‑day count;
- the header shows provenance from `proMeta` (e.g. *"1,234 games · patches 14.10–14.19 · LCK, LEC…"*);
- per‑cell rating readouts subtract `k` to display the real number of pro games behind a value.

### 10.8 Pro mode — strengths & limitations

**Strengths**

- **Right population.** Unlike soloqueue, these are actual professional games, so base champion strength reflects the competitive meta (priority picks, contested champions) rather than ladder behaviour.
- **Built from primary data, auditable and controllable.** Vantage aggregates the tables itself, can scope by patch/league, and counts every skipped game by reason — nothing is a black box.
- **No leakage by construction.** Only draft‑time columns are read, so a "draft‑phase" prediction genuinely uses only draft‑phase information.
- **Principled, *validated* stabilisation.** The blend strength `k` is chosen by a temporal backtest against proper scoring rules and calibration (log‑loss / Brier / ECE), not hand‑tuned; and it degrades gracefully to soloqueue‑informed base strength where pro data is thin.

**Limitations**

- **Sample scarcity dominates.** Even blended, most *specific* matchups/synergies have near‑zero pro observations, so the "pro‑ness" of a prediction lives almost entirely in **base** winrates; interaction terms are mostly prior. Pro mode is closer to "pro‑weighted champion tiers" than "pro matchup knowledge".
- **Interaction priors collapse to base rates** (see 10.5): pro matchup/synergy cells are shrunk toward soloqueue *base* winrates, not soloqueue matchup data, so they inherit less structure than soloqueue mode has.
- **Bans and pick order are ingested but unused.** The single most important pro‑draft mechanic — **bans** — and draft sequence / counter‑pick order are captured in `ProMatch` (`orderKnown`, `blueBans`, `redBans`) yet don't enter the prediction. Fearless draft and side/first‑pick selection aren't modelled.
- **Side‑agnostic and player‑agnostic.** No blue‑side advantage (the backtest shows the base‑rate baseline captures it, the engine doesn't), and no team/player identity — pro results are heavily roster‑driven, which a champion‑only model can't see.
- **Meta/league pooling.** Mixing patches and leagues blends genuinely different metas under a single `k`; the prior term still carries soloqueue population bias.
- **Upstream fragility.** The Oracle's Elixir file URL changes yearly and its columns are not contractually guaranteed.

---

## Part 11 — Soloqueue vs pro at a glance

| | Soloqueue mode | Pro mode |
|---|---|---|
| **Raw source** | lolalytics.com (scraped aggregates) | Oracle's Elixir (raw per‑game CSV) |
| **Population** | Emerald+ ranked soloqueue, all regions | Professional matches (by league) |
| **Who builds the tables** | lolalytics (Vantage reshapes) | Vantage (aggregates from scratch) |
| **Sample size** | Millions of games | Hundreds–thousands of games |
| **Stabilisation** | Shrink current‑patch → champion's 30‑day form; strength = Risk Level | Shrink pro cell → soloqueue prior on Elo scale; strength = `k` (backtested) |
| **Interactions** | 30‑day matchup/synergy tables | Only pro‑observed cells; else degrades to base + expected |
| **Bans / draft order** | Not modelled | Ingested (`orderKnown`, bans) but not yet used in the prediction |
| **Recentring** | `removeRankBias` | `removeRankBias` (same) |
| **Rating maths** | Parts 3–5 | Parts 3–5 (identical) |

---

## Appendix — File & symbol map

| Concern | Location |
|---|---|
| lolalytics fetch + Qwik de‑reference | `apps/dataset/src/lolalytics/qwik.ts`, `qwik-champion2.ts` |
| Raw → `ChampionRoleData` transform | `apps/dataset/src/lolalytics/index.ts` |
| Build orchestration, two snapshots | `apps/dataset/src/index.ts` |
| Elo ↔ winrate | `packages/core/src/rating/ratings.ts` |
| Recentre dataset / drop interactions | `packages/core/src/models/dataset/Dataset.ts` |
| Core prediction (base, matchup, duo, ±) | `packages/core/src/draft/analysis.ts` |
| Cell lookup with safe fallbacks | `packages/core/src/draft/utils.ts` |
| Suggestions + min‑games filter | `packages/core/src/draft/suggestions.ts` |
| Prior strength per risk level | `packages/core/src/risk/risk-level.ts` |
| Time‑curve (separate) analysis | `packages/core/src/draft/extra-analysis.ts` |
| **Pro** — OE columns + CSV fetch | `apps/dataset/src/pro/oracles-elixir.ts`, `csv.ts` |
| **Pro** — champion / position mapping | `apps/dataset/src/pro/champion-map.ts`, `positions.ts` |
| **Pro** — normalise raw rows → matches | `apps/dataset/src/pro/normalize.ts` (`types.ts`) |
| **Pro** — aggregate matches → counts | `apps/dataset/src/pro/aggregate.ts` |
| **Pro** — blend onto soloqueue prior | `apps/dataset/src/pro/blend.ts` |
| **Pro** — assemble dataset + `proMeta` | `apps/dataset/src/pro/build.ts` |
| **Pro** — build entrypoint (store) | `apps/dataset/src/pro-index.ts` |
| **Pro** — temporal backtest / `k` sweep | `apps/dataset/src/pro/backtest.ts`, `pro-backtest.ts` |
| **Pro** — runtime toggle + config | `apps/frontend/src/contexts/DatasetContext.tsx`, `DraftAnalysisContext.tsx` |

### Key constants
- Elo divisor: **400**
- Prior strength `k`: **3000 / 2000 / 1000 / 500 / 250** (very‑low → very‑high risk)
- lolalytics filters: **tier = emerald_plus, region = all** (synergy endpoint also **queue = ranked**; build page defaults to ranked)
- Snapshots: **current‑patch** (base winrates) + **30‑days** (matchups & synergies)
- `DATASET_VERSION = "5"`

**Pro mode**
- Source: **Oracle's Elixir** per‑game CSV (URL via `OE_CSV_URL`)
- Columns used: draft‑time only (`pick1..5`, `ban1..5`, `position`, `champion`, `result`, `patch`, `league`, …) — no in‑game stats
- Blend prior strength `k`: default **100** (`PRO_PRIOR_GAMES`), backtested; blended on the **Elo scale**
- Runtime filter: `scaleGamesToWeek = false`, `gamesOffset = k`, `proMinGames = 20`
- Stored as **`pro-current-patch`**; provenance in `proMeta` (matches, patches, leagues, `builtAt`, `k`)
- Backtest metrics: **log‑loss, Brier, accuracy, ECE** (10‑bin); `k` chosen by lowest held‑out log‑loss
