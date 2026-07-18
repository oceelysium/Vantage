import { getChampions, getVersions } from "../riot";
import { fetchOraclesElixir } from "./oracles-elixir";
import { buildChampionMap } from "./champion-map";
import { normalizeMatches, type NormalizeResult } from "./normalize";

export * from "./types";
export * from "./csv";
export * from "./oracles-elixir";
export * from "./champion-map";
export * from "./positions";
export * from "./normalize";
export * from "./aggregate";
export * from "./blend";
export * from "./build";
export * from "./backtest";

/**
 * End-to-end M1 entrypoint: fetch Riot champions, fetch an Oracle's Elixir file,
 * and return normalized ProMatch objects. This is the input to Phase 1 aggregation
 * (M2). It performs no aggregation or blending itself.
 */
export async function loadProMatches(opts: {
    url?: string;
    version?: string;
} = {}): Promise<NormalizeResult> {
    const version = opts.version ?? (await getVersions())[0];
    const champions = await getChampions(version);
    const rows = await fetchOraclesElixir(opts.url);
    const championMap = buildChampionMap(champions);
    return normalizeMatches(rows, championMap);
}
