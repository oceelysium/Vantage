import { readFile } from "fs/promises";
import { resolve } from "path";
import {
    DATASET_VERSION,
    type Dataset,
} from "@draftgap/core/src/models/dataset/Dataset";
import type { RiskLevel } from "@draftgap/core/src/risk/risk-level";
import { getChampions, getVersions } from "./riot";
import { parseOeRows } from "./pro/oracles-elixir";
import { buildChampionMap } from "./pro/champion-map";
import { normalizeMatches } from "./pro/normalize";
import { backtest, bestBlended, type BacktestReport } from "./pro/backtest";
import type { ProMatch } from "./pro/types";

/**
 * Backtest the pro blend against soloqueue on held-out pro games.
 *
 * Usage:  bun run pro:backtest <oe1.csv> [oe2.csv ...]
 * Env:
 *   SPLIT_DATE   train/test cutoff (default: 75th percentile of match dates)
 *   K_GRID       comma-separated prior strengths (default 0,25,50,100,200,400)
 *   RISK_LEVEL   analyzeDraft risk level (default "medium")
 */

const K_GRID = (process.env.K_GRID ?? "0,25,50,100,200,400")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
const RISK_LEVEL = (process.env.RISK_LEVEL ?? "medium") as RiskLevel;

// Defaults to the upstream DraftGap bucket; override with DATASET_BASE_URL.
const DATASET_BASE_URL =
    process.env.DATASET_BASE_URL ?? "https://bucket.draftgap.com";

async function fetchPublicDataset(name: string): Promise<Dataset> {
    const url = `${DATASET_BASE_URL}/datasets/v${DATASET_VERSION}/${name}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch prior (${res.status}): ${url}`);
    return (await res.json()) as Dataset;
}

function quantileDate(matches: ProMatch[], q: number): string {
    const dates = matches.map((m) => m.date).sort();
    return dates[Math.floor(dates.length * q)] ?? dates[dates.length - 1];
}

function pct(x: number) {
    return (x * 100).toFixed(2);
}

function printReport(report: BacktestReport, splitDate: string) {
    console.log(
        `\nSplit @ ${splitDate}  |  train=${report.trainCount}  test=${report.testCount}  |  base blue winrate=${pct(report.baseRate)}%\n`,
    );
    console.log(
        "model        k      acc%    logLoss   brier    ECE".padEnd(52),
    );
    console.log("-".repeat(52));
    for (const r of report.rows) {
        const m = r.metrics;
        const name = (r.model + (r.k !== undefined ? `(${r.k})` : "")).padEnd(
            12,
        );
        console.log(
            `${name} ${String(r.k ?? "").padStart(4)}  ${pct(m.accuracy).padStart(6)}   ${m.logLoss.toFixed(4)}   ${m.brier.toFixed(4)}   ${m.ece.toFixed(4)}`,
        );
    }
    const best = bestBlended(report);
    const soloq = report.rows.find((r) => r.model === "soloq");
    if (best && soloq) {
        console.log(
            `\nBest blended: k=${best.k} (logLoss ${best.metrics.logLoss.toFixed(4)}) vs soloq ${soloq.metrics.logLoss.toFixed(4)} ` +
                `-> ${best.metrics.logLoss < soloq.metrics.logLoss ? "PRO WINS" : "no improvement"}`,
        );
    }
}

async function main() {
    const inputs = process.argv.slice(2).filter((a) => !a.startsWith("-"));
    if (inputs.length === 0) {
        console.error("Usage: bun run pro:backtest <oracles-elixir.csv> [more.csv ...]");
        process.exit(1);
    }

    console.log("Fetching Riot champions + soloqueue prior...");
    const version = (await getVersions())[0];
    const [champions, prior] = await Promise.all([
        getChampions(version),
        fetchPublicDataset("current-patch"),
    ]);
    const championMap = buildChampionMap(champions);

    const matches: ProMatch[] = [];
    for (const file of inputs) {
        const csv = await readFile(resolve(file), "utf8");
        const { matches: ms } = normalizeMatches(parseOeRows(csv), championMap);
        matches.push(...ms);
    }
    console.log(`Loaded ${matches.length} pro matches`);

    const splitDate = process.env.SPLIT_DATE ?? quantileDate(matches, 0.75);
    const report = backtest(matches, prior, {
        splitDate,
        kGrid: K_GRID,
        config: {
            ignoreChampionWinrates: false,
            riskLevel: RISK_LEVEL,
            minGames: 0,
        },
    });
    printReport(report, splitDate);
}

main();
