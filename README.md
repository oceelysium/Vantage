# Vantage

Vantage analyses League of Legends drafts and estimates each team's win probability from champion win rates, lane matchups and duo synergies — with calibrated uncertainty, so you know when to trust the number.

It works on **soloqueue** data and on **professional match data**, and you can switch between them in-app.

> Vantage is a derivative of [DraftGap](https://github.com/vigovlugt/draftgap) by Vigo Vlugt, used under the MIT licence. See [Attribution](#attribution).

---

## What it does

- **Draft win probability** — an Elo-style additive model over champion base rates, lane matchups and within-team duo synergies, smoothed toward a prior in proportion to each cell's sample size.
- **Calibrated uncertainty** — every prediction carries a ± standard error derived from the real sample sizes behind it, so thin data reads as low confidence instead of false precision.
- **Pro mode** — build a dataset from [Oracle's Elixir](https://oracleselixir.com) professional match data, blended onto a soloqueue prior on the Elo scale. Scope it by patch and league.
- **Sample-size transparency** — current-patch game counts in the header, a "thin patch" flag when a new patch hasn't accumulated data yet, and low-sample warnings on individual numbers.
- **Off-meta picks** — search any champion and place it in any role, even with no data, so you can enter drafts exactly as they happened.

## Getting started

Requires [Bun](https://bun.sh).

```bash
bun install
cd apps/frontend
bun run dev
```

The app runs at `http://localhost:3000`.

### Pro mode

1. Download a season CSV from [Oracle's Elixir](https://oracleselixir.com/tools/downloads).
2. Build the pro dataset:

```bash
cd apps/dataset
bun run pro:local ~/Downloads/2026_LoL_esports_match_data_from_OraclesElixir.csv
```

3. In the app, open **Settings → Data → Data source** and choose **Pro**.

Optional scoping and tuning:

```bash
PRO_PATCH=16.10 bun run pro:local <csv>        # restrict to one patch
PRO_LEAGUE=LCK,LPL bun run pro:local <csv>     # restrict to leagues
PRO_PRIOR_GAMES=50 bun run pro:local <csv>     # prior strength k
```

### Validating the model

The backtest scores the pro blend against soloqueue on held-out games using a temporal split — reporting accuracy, log-loss, Brier score and calibration error, and sweeping the prior strength `k`:

```bash
cd apps/dataset
bun run pro:backtest ~/Downloads/2026_LoL_esports_match_data_from_OraclesElixir.csv
```

### Tests

```bash
cd apps/dataset
bun test src/pro
```

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_DATASET_BASE_URL` | frontend | Host serving the soloqueue datasets. **Defaults to the upstream DraftGap bucket** — point this at your own host before deploying anything public. |
| `DATASET_BASE_URL` | dataset scripts | Same, for `pro:local` / `pro:backtest`. |
| `VITE_GA_TAG` | frontend | Google Analytics tag. Unset by default; no analytics are sent without it. |
| `OE_CSV_URL` | dataset | Oracle's Elixir CSV URL for the non-local builder. |

## Hosting your own data

The soloqueue datasets default to `bucket.draftgap.com`, which belongs to the upstream DraftGap project. That's fine for local personal use, but **if you deploy Vantage publicly, host your own datasets** rather than serving traffic at the original author's expense. `apps/dataset` contains the builder that produces them.

## Accuracy expectations

Draft is only one input to a result; execution decides the rest. Draft-only predictors in the literature cluster around 53–58% accuracy, and Vantage sits in that range. The point isn't to call games — it's to compare drafts and show where advantage was won or lost, with honest uncertainty attached.

## Attribution

Vantage is built on [DraftGap](https://github.com/vigovlugt/draftgap) by **Vigo Vlugt**, MIT licensed. The core Elo-style draft model and the application shell originate there; Vantage adds the professional-data pipeline, calibrated uncertainty, sample-size transparency and a redesigned interface.

Data sources:

- Soloqueue statistics via [Lolalytics](https://lolalytics.com). Please be mindful of the load you place on them.
- Professional match data from [Oracle's Elixir](https://oracleselixir.com), compiled by Tim Sevenhuysen.
- Champion and item data from Riot Games' Data Dragon.

Vantage isn't endorsed by Riot Games and doesn't reflect the views of Riot Games or anyone officially involved in producing or managing League of Legends.

## Licence

MIT — see [LICENSE](./LICENSE). Original work © Vigo Vlugt; modifications © Elysium.
