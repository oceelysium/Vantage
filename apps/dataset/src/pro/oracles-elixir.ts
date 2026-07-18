import { parseCsv } from "./csv";

/** A raw Oracle's Elixir row, keyed by CSV column name. */
export type OeRow = Record<string, string>;

/**
 * Draft-time columns we rely on from Oracle's Elixir.
 *
 * IMPORTANT: verify these names against the current OE "Definitions" page before
 * relying on a new season's file — column names have been stable historically but
 * are not contractually guaranteed. We deliberately consume ONLY draft-time columns
 * (no gold/kills/objectives/gamelength) so no in-game signal can leak into the model.
 */
export const OE_COLUMNS = {
    gameId: "gameid",
    dataCompleteness: "datacompleteness",
    date: "date",
    patch: "patch",
    league: "league",
    side: "side",
    position: "position",
    playerName: "playername",
    teamName: "teamname",
    champion: "champion",
    result: "result",
    bans: ["ban1", "ban2", "ban3", "ban4", "ban5"],
    picks: ["pick1", "pick2", "pick3", "pick4", "pick5"],
} as const;

/** Fetch the raw CSV text for an Oracle's Elixir data file. */
export async function fetchOeCsvText(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(
            `Failed to fetch Oracle's Elixir CSV (${res.status}): ${url}`,
        );
    }
    return res.text();
}

/** Parse OE CSV text into raw rows. */
export function parseOeRows(csvText: string): OeRow[] {
    return parseCsv(csvText);
}

/**
 * Fetch + parse an Oracle's Elixir data file.
 *
 * The download URL is intentionally not hardcoded: OE distributes yearly files via
 * links published on https://oracleselixir.com/tools/downloads and the URL changes.
 * Provide it explicitly or via the OE_CSV_URL environment variable. Local fixtures
 * are loaded directly in tests without going through this function.
 */
export async function fetchOraclesElixir(
    url: string | undefined = process.env.OE_CSV_URL,
): Promise<OeRow[]> {
    if (!url) {
        throw new Error(
            "No Oracle's Elixir CSV URL provided (set OE_CSV_URL or pass a url).",
        );
    }
    return parseOeRows(await fetchOeCsvText(url));
}
