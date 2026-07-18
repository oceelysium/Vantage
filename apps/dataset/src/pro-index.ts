import "dotenv/config";
import { removeRankBias } from "@draftgap/core/src/models/dataset/Dataset";
import { getDataset, storeDataset } from "./storage/storage";
import { loadProMatches } from "./pro";
import { aggregateProGames } from "./pro/aggregate";
import { buildProDataset, computeProMeta } from "./pro/build";
import type { ProMatch } from "./pro/types";

/**
 * Phase 1 pro dataset builder (M4).
 *
 * Pipeline: soloqueue prior (S3) + Oracle's Elixir matches
 *   -> normalize -> aggregate -> blend onto the prior -> removeRankBias -> store.
 *
 * The result is a standard Dataset stored as "pro-current-patch", which the
 * existing Elo engine and (once M6 wires the toggle) the frontend can consume.
 *
 * Env:
 *   OE_CSV_URL        Oracle's Elixir CSV download URL (required).
 *   PRO_PRIOR_GAMES   Prior strength k (default 100; tuned by the M5 backtest).
 *   PRO_PATCH         Optional: restrict aggregation to a single patch (e.g. "14.13").
 */

const PRO_PRIOR_GAMES = Number(process.env.PRO_PRIOR_GAMES ?? 100);

function csvEnv(name: string): Set<string> | undefined {
    const v = process.env[name];
    if (!v) return undefined;
    const set = new Set(v.split(",").map((s) => s.trim()).filter(Boolean));
    return set.size > 0 ? set : undefined;
}

const PATCH_FILTER = csvEnv("PRO_PATCH");
const LEAGUE_FILTER = csvEnv("PRO_LEAGUE");

async function main() {
    console.log("Loading soloqueue prior (current-patch)...");
    const prior = await getDataset({ name: "current-patch" });

    console.log("Loading Oracle's Elixir pro matches...");
    const { matches, skip } = await loadProMatches({
        url: process.env.OE_CSV_URL,
    });
    console.log(
        `Loaded ${matches.length} matches (skipped ${skip.skipped}: ${JSON.stringify(skip.reasons)})`,
    );

    const inScope = (m: ProMatch) =>
        (!PATCH_FILTER || PATCH_FILTER.has(m.patch)) &&
        (!LEAGUE_FILTER || LEAGUE_FILTER.has(m.league));
    const usedMatches = matches.filter(inScope);
    const aggregate = aggregateProGames(usedMatches);
    const meta = computeProMeta(usedMatches, PRO_PRIOR_GAMES);
    console.log(
        `Aggregated ${Object.keys(aggregate.base).length} champions from ` +
            `${usedMatches.length} matches | patches ${meta.patches.join(",")} | leagues ${meta.leagues.join(",")}`,
    );

    console.log(`Blending onto prior (k=${PRO_PRIOR_GAMES})...`);
    const proDataset = buildProDataset(prior, aggregate, {
        blend: { priorGames: PRO_PRIOR_GAMES, ratingScale: true },
    });
    proDataset.proMeta = meta;

    // Center base rates exactly as the soloqueue pipeline does.
    removeRankBias(proDataset);

    await storeDataset(proDataset, { name: "pro-current-patch" });
    console.log("Stored pro-current-patch dataset.");
}

main();
