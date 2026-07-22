import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import {
    DATASET_VERSION,
    removeRankBias,
    type Dataset,
} from "@draftgap/core/src/models/dataset/Dataset";
import {
    type Tier,
    DEFAULT_TIER,
    tierDatasetName,
} from "@draftgap/core/src/models/Tier";
import { getChampions, getVersions } from "./riot";
import { parseOeRows } from "./pro/oracles-elixir";
import { buildChampionMap } from "./pro/champion-map";
import { normalizeMatches } from "./pro/normalize";
import { aggregateProGames } from "./pro/aggregate";
import { buildProDataset, computeProMeta } from "./pro/build";
import type { ProMatch } from "./pro/types";

/**
 * Local, no-infra pro dataset builder.
 *
 * Reads one or more Oracle's Elixir CSV files from disk, pulls the soloqueue prior
 * from the public DraftGap bucket, blends, and writes pro-current-patch.json into
 * the frontend's public/ folder so `bun run dev` serves it at
 * /datasets/pro-current-patch.json (consumed by the M6 data-source toggle).
 *
 * Usage:
 *   bun run pro:local <oe1.csv> [oe2.csv ...]
 *
 * Env:
 *   PRO_PRIOR_GAMES  prior strength k (default 100)
 *   PRO_PATCH        restrict to these patches (comma-separated), e.g. "16.09,16.10"
 *   PRO_LEAGUE       restrict to these leagues (comma-separated), e.g. "LCK,LPL"
 *   PRO_OUTPUT       override the output file path
 */

const HERE = new URL(".", import.meta.url).pathname; // apps/dataset/src/
const DEFAULT_OUTPUT = resolve(
    HERE,
    "../../frontend/public/datasets/pro-current-patch.json",
);

const PRO_PRIOR_GAMES = Number(process.env.PRO_PRIOR_GAMES ?? 100);

function csvEnv(name: string): Set<string> | undefined {
    const v = process.env[name];
    if (!v) return undefined;
    const set = new Set(v.split(",").map((s) => s.trim()).filter(Boolean));
    return set.size > 0 ? set : undefined;
}

const PATCH_FILTER = csvEnv("PRO_PATCH");
const LEAGUE_FILTER = csvEnv("PRO_LEAGUE");

function inScope(m: ProMatch): boolean {
    if (PATCH_FILTER && !PATCH_FILTER.has(m.patch)) return false;
    if (LEAGUE_FILTER && !LEAGUE_FILTER.has(m.league)) return false;
    return true;
}

// Defaults to the upstream DraftGap bucket; override with DATASET_BASE_URL.
const DATASET_BASE_URL =
    process.env.DATASET_BASE_URL ?? "https://bucket.draftgap.com";

async function fetchPublicDataset(name: string): Promise<Dataset> {
    const url = `${DATASET_BASE_URL}/datasets/v${DATASET_VERSION}/${name}.json`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch soloqueue prior (${res.status}): ${url}`);
    }
    return (await res.json()) as Dataset;
}

// Diamond+ is a closer prior to pro than Emerald+. Falls back to the default
// tier when the higher-tier dataset isn't available.
const PRO_PRIOR_TIER = (process.env.PRO_PRIOR_TIER as Tier) ?? "diamond_plus";

// When DATASET_LOCAL_DIR is set, read the prior from the local filesystem
// (produced by `bun run start` with the same env) instead of a bucket.
const LOCAL_DIR = process.env.DATASET_LOCAL_DIR;

async function readLocalDataset(name: string): Promise<Dataset> {
    const path = resolve(LOCAL_DIR!, `v${DATASET_VERSION}`, `${name}.json`);
    return JSON.parse(await readFile(path, "utf8")) as Dataset;
}

async function fetchPrior(tier: Tier): Promise<Dataset> {
    const load = LOCAL_DIR ? readLocalDataset : fetchPublicDataset;
    const name = tierDatasetName("current-patch", tier);
    try {
        const ds = await load(name);
        console.log(
            `Using ${tier} prior (${name})${LOCAL_DIR ? " [local]" : ""}.`,
        );
        return ds;
    } catch (e) {
        if (tier === DEFAULT_TIER) throw e;
        console.warn(
            `Prior "${name}" unavailable; falling back to ${DEFAULT_TIER}.`,
        );
        return load("current-patch");
    }
}

async function main() {
    const inputs = process.argv.slice(2).filter((a) => !a.startsWith("-"));
    if (inputs.length === 0) {
        console.error(
            "Usage: bun run pro:local <oracles-elixir.csv> [more.csv ...]",
        );
        process.exit(1);
    }
    const outFile = process.env.PRO_OUTPUT ?? DEFAULT_OUTPUT;

    console.log("Fetching Riot champion list...");
    const version = (await getVersions())[0];
    const champions = await getChampions(version);
    const championMap = buildChampionMap(champions);

    const allMatches: ProMatch[] = [];
    for (const file of inputs) {
        const path = resolve(file);
        console.log(`Reading ${path} ...`);
        const csv = await readFile(path, "utf8");
        const { matches, skip } = normalizeMatches(parseOeRows(csv), championMap);
        console.log(
            `  ${matches.length} matches (skipped ${skip.skipped}: ${JSON.stringify(skip.reasons)})`,
        );
        allMatches.push(...matches);
    }
    console.log(`Total: ${allMatches.length} pro matches`);

    console.log(`Fetching soloqueue prior (tier ${PRO_PRIOR_TIER})...`);
    const prior = await fetchPrior(PRO_PRIOR_TIER);

    const usedMatches = allMatches.filter(inScope);
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
    removeRankBias(proDataset);

    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, JSON.stringify(proDataset));
    console.log(`\nWrote ${outFile}`);
    console.log(
        "Start the frontend (bun run dev in apps/frontend) and switch Data source to Pro in Settings.",
    );
}

main();
