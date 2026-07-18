import type { Dataset } from "@draftgap/core/src/models/dataset/Dataset";
import {
    analyzeDraft,
    type AnalyzeDraftConfig,
} from "@draftgap/core/src/draft/analysis";
import type { Role } from "@draftgap/core/src/models/Role";
import type { ProMatch, ProPick } from "./types";
import { aggregateProGames } from "./aggregate";
import { buildProDataset } from "./build";
import { clampWinrate } from "./blend";

export type BacktestMetrics = {
    n: number;
    accuracy: number;
    logLoss: number;
    brier: number;
    /** Expected calibration error (10 bins). */
    ece: number;
};

export type Prediction = { p: number; y: 0 | 1 };

/** Proper scoring + calibration over a set of (probability, outcome) pairs. */
export function computeMetrics(predictions: Prediction[]): BacktestMetrics {
    const n = predictions.length;
    if (n === 0) return { n: 0, accuracy: 0, logLoss: 0, brier: 0, ece: 0 };

    let correct = 0;
    let logLoss = 0;
    let brier = 0;
    const bins = Array.from({ length: 10 }, () => ({ sumP: 0, sumY: 0, n: 0 }));

    for (const { p, y } of predictions) {
        const pc = clampWinrate(p, 1e-12);
        if ((p >= 0.5 ? 1 : 0) === y) correct++;
        logLoss += -(y * Math.log(pc) + (1 - y) * Math.log(1 - pc));
        brier += (p - y) ** 2;
        const b = Math.min(9, Math.max(0, Math.floor(p * 10)));
        bins[b].sumP += p;
        bins[b].sumY += y;
        bins[b].n++;
    }

    let ece = 0;
    for (const bin of bins) {
        if (bin.n === 0) continue;
        ece += (bin.n / n) * Math.abs(bin.sumY / bin.n - bin.sumP / bin.n);
    }

    return {
        n,
        accuracy: correct / n,
        logLoss: logLoss / n,
        brier: brier / n,
        ece,
    };
}

function teamMap(picks: ProPick[]): Map<Role, string> {
    const m = new Map<Role, string>();
    for (const p of picks) m.set(p.role, p.championKey);
    return m;
}

const outcome = (m: ProMatch): 0 | 1 => (m.winner === "blue" ? 1 : 0);

/**
 * Predict P(blue win) for a match from champions alone, via the Elo engine.
 * Note: analyzeDraft is side-agnostic, so this captures champion/matchup/synergy
 * value but not blue-side advantage (which the base-rate baseline does capture).
 */
export function predictBlueWin(
    dataset: Dataset,
    fullDataset: Dataset,
    match: ProMatch,
    config: AnalyzeDraftConfig,
): number {
    const result = analyzeDraft(
        dataset,
        fullDataset,
        teamMap(match.bluePicks),
        teamMap(match.redPicks),
        config,
    );
    return clampWinrate(result.winrate);
}

export type BacktestOptions = {
    /** Matches with date < splitDate are training; date >= splitDate are test. */
    splitDate: string;
    /** Prior-strength values to sweep (k=0 is the pro-heavy extreme). */
    kGrid: number[];
    config: AnalyzeDraftConfig;
};

export type BacktestRow = { model: string; k?: number; metrics: BacktestMetrics };

export type BacktestReport = {
    trainCount: number;
    testCount: number;
    baseRate: number;
    rows: BacktestRow[];
};

/**
 * Temporal backtest. Trains the pro blend on matches before splitDate and scores
 * held-out matches after it, comparing:
 *   - base-rate  : constant blue win rate from training.
 *   - soloq      : the prior dataset alone (no pro blend).
 *   - blended(k) : pro data blended onto the prior, for each k in kGrid.
 */
export function backtest(
    matches: ProMatch[],
    prior: Dataset,
    opts: BacktestOptions,
): BacktestReport {
    const train = matches.filter((m) => m.date < opts.splitDate);
    const test = matches.filter((m) => m.date >= opts.splitDate);
    const trainAgg = aggregateProGames(train);

    const baseRate =
        train.length > 0
            ? train.filter((m) => m.winner === "blue").length / train.length
            : 0.5;

    const rows: BacktestRow[] = [];

    // base rate: constant prediction
    rows.push({
        model: "base-rate",
        metrics: computeMetrics(
            test.map((m) => ({ p: baseRate, y: outcome(m) })),
        ),
    });

    // soloqueue prior alone
    rows.push({
        model: "soloq",
        metrics: computeMetrics(
            test.map((m) => ({
                p: predictBlueWin(prior, prior, m, opts.config),
                y: outcome(m),
            })),
        ),
    });

    // blended, swept over k
    for (const k of opts.kGrid) {
        const ds = buildProDataset(prior, trainAgg, {
            blend: { priorGames: k, ratingScale: true },
        });
        rows.push({
            model: "blended",
            k,
            metrics: computeMetrics(
                test.map((m) => ({
                    p: predictBlueWin(ds, ds, m, opts.config),
                    y: outcome(m),
                })),
            ),
        });
    }

    return {
        trainCount: train.length,
        testCount: test.length,
        baseRate,
        rows,
    };
}

/** Pick the blended row with the lowest held-out log-loss. */
export function bestBlended(report: BacktestReport): BacktestRow | undefined {
    return report.rows
        .filter((r) => r.model === "blended")
        .sort((a, b) => a.metrics.logLoss - b.metrics.logLoss)[0];
}
