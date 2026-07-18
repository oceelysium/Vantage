/** The champion fields this module needs. Compatible with RiotChampion and the
 * (i18n-less) objects returned by riot.ts::getChampions. */
export type ChampionRef = { id: string; key: string; name: string };

/**
 * Maps Oracle's Elixir champion display names (e.g. "Nunu & Willump", "Kai'Sa")
 * to Riot numeric champion keys (e.g. "20", "145"), matching how the dataset keys
 * champions everywhere else.
 *
 * OE names generally match Riot's display `name`; a few historical/edge cases don't,
 * which the alias table below covers. Unmapped names throw loudly so a renamed or
 * newly released champion can never be silently dropped from the corpus.
 */

/** Lowercase and strip everything but a-z0-9 so punctuation/spacing never matters. */
export function normalizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Normalized OE name -> normalized Riot name/id, for cases the direct match misses.
 * Extend this as the coverage test surfaces new mismatches for a given season.
 */
export const CHAMPION_NAME_ALIASES: Record<string, string> = {
    // OE has historically used a bare "Nunu" in older files.
    nunu: "nunuwillump",
    // "MonkeyKing" is Wukong's internal id; OE uses "Wukong".
    monkeyking: "wukong",
    // Occasionally seen abbreviations.
    wukongmonkeyking: "wukong",
};

/**
 * Build a lookup from normalized champion name/id to Riot numeric key.
 * Indexing by both `name` and `id` means both "Wukong" and "MonkeyKing" resolve.
 */
export function buildChampionMap(champions: ChampionRef[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const c of champions) {
        map.set(normalizeName(c.name), c.key);
        map.set(normalizeName(c.id), c.key);
    }
    return map;
}

/** Resolve an OE champion name to a Riot key, or throw if unknown. */
export function mapChampionName(
    oeName: string,
    map: Map<string, string>,
): string {
    const norm = normalizeName(oeName);
    const key = map.get(norm) ?? map.get(CHAMPION_NAME_ALIASES[norm] ?? norm);
    if (!key) {
        throw new Error(
            `Unmapped champion name from Oracle's Elixir: "${oeName}" (normalized "${norm}")`,
        );
    }
    return key;
}
