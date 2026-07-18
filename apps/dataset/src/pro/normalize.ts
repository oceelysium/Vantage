import { Role } from "@draftgap/core/src/models/Role";
import type { ProMatch, ProPick } from "./types";
import { OE_COLUMNS, type OeRow } from "./oracles-elixir";
import { oePositionToRole } from "./positions";
import { mapChampionName } from "./champion-map";

const TEAM_POSITION = "team";

/** Count of games dropped during normalization, by reason. */
export type SkipReport = {
    skipped: number;
    reasons: Record<string, number>;
};

export type NormalizeResult = {
    matches: ProMatch[];
    skip: SkipReport;
};

/**
 * Convert raw Oracle's Elixir rows into normalized ProMatch objects.
 *
 * OE emits ~12 rows per game: 5 player rows per side plus one team-summary row per
 * side (position === "team"). We read champions/roles/result from player rows and
 * pick order + bans from the team rows.
 */
export function normalizeMatches(
    rows: OeRow[],
    championMap: Map<string, string>,
): NormalizeResult {
    const skip: SkipReport = { skipped: 0, reasons: {} };
    const bump = (reason: string) => {
        skip.reasons[reason] = (skip.reasons[reason] ?? 0) + 1;
        skip.skipped++;
    };

    // group rows by game id, preserving row order
    const games = new Map<string, OeRow[]>();
    for (const r of rows) {
        const id = r[OE_COLUMNS.gameId];
        if (!id) continue;
        let arr = games.get(id);
        if (!arr) {
            arr = [];
            games.set(id, arr);
        }
        arr.push(r);
    }

    const matches: ProMatch[] = [];

    for (const [gameId, gameRows] of games) {
        try {
            // only fully-complete games (OE marks partial/ignore rows)
            const completeness = gameRows[0]?.[OE_COLUMNS.dataCompleteness];
            if (completeness && completeness !== "complete") {
                bump("incomplete");
                continue;
            }

            const players = gameRows.filter(
                (r) => positionOf(r) !== TEAM_POSITION,
            );
            const teams = gameRows.filter(
                (r) => positionOf(r) === TEAM_POSITION,
            );

            const bluePlayers = players.filter((r) => sideOf(r) === "blue");
            const redPlayers = players.filter((r) => sideOf(r) === "red");
            if (bluePlayers.length !== 5 || redPlayers.length !== 5) {
                bump("wrong_player_count");
                continue;
            }

            const blueTeam = teams.find((r) => sideOf(r) === "blue");
            const redTeam = teams.find((r) => sideOf(r) === "red");

            const winner = resolveWinner(bluePlayers[0], blueTeam);
            if (!winner) {
                bump("no_winner");
                continue;
            }

            const blue = buildPicks(bluePlayers, blueTeam, championMap);
            const red = buildPicks(redPlayers, redTeam, championMap);

            const meta = blueTeam ?? bluePlayers[0];
            matches.push({
                gameId,
                date: meta[OE_COLUMNS.date] ?? "",
                patch: normalizePatch(meta[OE_COLUMNS.patch] ?? ""),
                league: meta[OE_COLUMNS.league] ?? "",
                bluePicks: blue.picks,
                redPicks: red.picks,
                blueBans: readBans(blueTeam, championMap),
                redBans: readBans(redTeam, championMap),
                winner,
                orderKnown: blue.orderKnown && red.orderKnown,
            });
        } catch (e) {
            const unmapped =
                e instanceof Error && e.message.startsWith("Unmapped champion");
            bump(unmapped ? "unmapped_champion" : "error");
        }
    }

    return { matches, skip };
}

function positionOf(r: OeRow): string {
    return (r[OE_COLUMNS.position] ?? "").trim().toLowerCase();
}

function sideOf(r: OeRow): "blue" | "red" | "" {
    const s = (r[OE_COLUMNS.side] ?? "").trim().toLowerCase();
    return s === "blue" ? "blue" : s === "red" ? "red" : "";
}

function resolveWinner(
    bluePlayer: OeRow | undefined,
    blueTeam: OeRow | undefined,
): "blue" | "red" | null {
    const blueResult = (blueTeam ?? bluePlayer)?.[OE_COLUMNS.result];
    if (blueResult === "1") return "blue";
    if (blueResult === "0") return "red";
    return null;
}

/** "14.13.1" -> "14.13"; already-short strings pass through unchanged. */
function normalizePatch(patch: string): string {
    const parts = patch.split(".");
    return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : patch;
}

function readBans(
    team: OeRow | undefined,
    map: Map<string, string>,
): string[] {
    if (!team) return [];
    const out: string[] = [];
    for (const col of OE_COLUMNS.bans) {
        const v = team[col];
        if (!v || v.trim().toLowerCase() === "none") continue;
        try {
            out.push(mapChampionName(v, map));
        } catch {
            // A ban that fails to map (rare data glitch) is non-fatal in Phase 1.
        }
    }
    return out;
}

/**
 * Build the ordered pick list for one team.
 * Prefers the team row's pick1..pick5 order; falls back to role order when the
 * pick columns are missing (older data), flagging orderKnown = false.
 */
function buildPicks(
    players: OeRow[],
    team: OeRow | undefined,
    map: Map<string, string>,
): { picks: ProPick[]; orderKnown: boolean } {
    const roleByChampKey = new Map<string, Role>();
    for (const p of players) {
        const role = oePositionToRole(p[OE_COLUMNS.position] ?? "");
        const champ = p[OE_COLUMNS.champion];
        if (role === null || !champ) {
            throw new Error("Bad player row: missing role or champion");
        }
        roleByChampKey.set(mapChampionName(champ, map), role);
    }

    const order: string[] = [];
    if (team) {
        for (const col of OE_COLUMNS.picks) {
            const v = team[col];
            if (v && v.trim()) order.push(mapChampionName(v, map));
        }
    }

    if (order.length === 5 && order.every((k) => roleByChampKey.has(k))) {
        return {
            picks: order.map((championKey) => ({
                championKey,
                role: roleByChampKey.get(championKey)!,
            })),
            orderKnown: true,
        };
    }

    // fallback: deterministic role order (top -> support)
    const picks = [...roleByChampKey.entries()]
        .map(([championKey, role]) => ({ championKey, role }))
        .sort((a, b) => a.role - b.role);
    return { picks, orderKnown: false };
}
