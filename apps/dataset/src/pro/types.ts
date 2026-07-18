import type { Role } from "@draftgap/core/src/models/Role";

/**
 * A single champion selection in a professional game.
 * `championKey` is the Riot numeric champion key (e.g. "62" for Wukong),
 * matching how the rest of the dataset keys champions.
 */
export type ProPick = {
    championKey: string;
    role: Role;
};

/**
 * A normalized professional match, derived from Oracle's Elixir rows.
 * Only draft-time information is retained (no in-game statistics) so this
 * type can never leak post-draft signal into a draft-phase model.
 */
export type ProMatch = {
    gameId: string;
    date: string; // ISO date string as provided by Oracle's Elixir
    patch: string; // normalized to major.minor, e.g. "14.13"
    league: string; // LCK, LPL, LEC, LTA, ...
    bluePicks: ProPick[]; // exactly 5
    redPicks: ProPick[]; // exactly 5
    blueBans: string[]; // championKeys, in ban order (kept for Phase 2)
    redBans: string[]; // championKeys, in ban order (kept for Phase 2)
    winner: "blue" | "red";
    /** true when pick order was recovered from OE pick columns; false if we fell back to role order. */
    orderKnown: boolean;
};

/** Aggregated win/game counts, mirroring the numeric fields of ChampionRoleData. */
export type Counts = { wins: number; games: number };

/**
 * Raw professional win/game counts, aggregated from ProMatch[].
 * Shapes mirror what ChampionRoleData needs so blending (M3) can map straight in.
 * Records are sparse: only observed champions/roles/pairings are present.
 */
export type ProAggregate = {
    /** base[championKey][role] */
    base: Record<string, Record<Role, Counts>>;
    /** matchup[championKey][allyRole][enemyRole][enemyChampionKey] — ally perspective */
    matchup: Record<
        string,
        Record<Role, Record<Role, Record<string, Counts>>>
    >;
    /** synergy[championKey][role][partnerRole][partnerChampionKey] */
    synergy: Record<
        string,
        Record<Role, Record<Role, Record<string, Counts>>>
    >;
};
