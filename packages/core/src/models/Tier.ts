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

// Local rank crests bundled in public/ranks/ (same-origin, no external dependency).
export const emblemUrlByTier: Record<Tier, string> = {
    platinum_plus: "/ranks/platinum.png",
    emerald_plus: "/ranks/emerald.png",
    diamond_plus: "/ranks/diamond.png",
    master_plus: "/ranks/master.png",
};

export const tierStyleByTier: Record<
    Tier,
    { text: string; bg: string; border: string; shadow: string }
> = {
    platinum_plus: {
        text: "text-teal-400",
        bg: "bg-teal-950/60",
        border: "border-teal-500/40",
        shadow: "shadow-[0_0_10px_rgba(20,184,166,0.2)]",
    },
    emerald_plus: {
        text: "text-emerald-400",
        bg: "bg-emerald-950/60",
        border: "border-emerald-500/40",
        shadow: "shadow-[0_0_10px_rgba(16,185,129,0.2)]",
    },
    diamond_plus: {
        text: "text-purple-300",
        bg: "bg-purple-950/60",
        border: "border-purple-500/40",
        shadow: "shadow-[0_0_10px_rgba(168,85,247,0.2)]",
    },
    master_plus: {
        text: "text-fuchsia-300",
        bg: "bg-fuchsia-950/60",
        border: "border-fuchsia-500/40",
        shadow: "shadow-[0_0_10px_rgba(217,70,239,0.2)]",
    },
};

/**
 * Storage/URL name for a dataset slot at a given tier. The default tier returns
 * the base name unchanged; other tiers append ".{tier}" so the files sit side by
 * side (e.g. "current-patch.diamond_plus.json").
 */
export function tierDatasetName(base: string, tier: Tier): string {
    return tier === DEFAULT_TIER ? base : `${base}.${tier}`;
}
