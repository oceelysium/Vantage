/**
 * Rank tiers ("level of play") the soloqueue datasets can be built for.
 *
 * The string values are the exact lolalytics `tier` query params, and are also
 * used verbatim as dataset filename suffixes, so they must stay URL/file safe.
 */
export const TIERS = [
    "platinum_plus",
    "emerald_plus",
    "diamond_plus",
    "master_plus",
] as const;

export type Tier = (typeof TIERS)[number];

/**
 * The canonical/default tier. Its datasets keep the *unsuffixed* filenames
 * (e.g. "current-patch.json") for backwards compatibility with existing
 * deployments and bundles; every other tier gets a ".{tier}" suffix.
 */
export const DEFAULT_TIER: Tier = "emerald_plus";

export const displayNameByTier: Record<Tier, string> = {
    platinum_plus: "Platinum+",
    emerald_plus: "Emerald+",
    diamond_plus: "Diamond+",
    master_plus: "Master+",
};

/**
 * Storage/URL name for a dataset slot at a given tier. The default tier returns
 * the base name unchanged; other tiers append ".{tier}" so the files sit side by
 * side (e.g. "current-patch.diamond_plus.json").
 */
export function tierDatasetName(base: string, tier: Tier): string {
    return tier === DEFAULT_TIER ? base : `${base}.${tier}`;
}
