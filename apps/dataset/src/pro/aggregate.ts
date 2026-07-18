import type { Role } from "@draftgap/core/src/models/Role";
import type { Counts, ProAggregate, ProMatch, ProPick } from "./types";

export type AggregateOptions = {
    /**
     * Optional predicate to include only certain matches — e.g. a patch window
     * or a specific league. When omitted, every match is counted.
     */
    filter?: (match: ProMatch) => boolean;
};

export function createEmptyAggregate(): ProAggregate {
    return { base: {}, matchup: {}, synergy: {} };
}

/**
 * Aggregate normalized pro matches into base / matchup / synergy win-game counts.
 *
 * Counting mirrors the soloqueue builder (apps/dataset/src/lolalytics/index.ts):
 *  - base:    one entry per champion-role.
 *  - matchup: ally champion vs each enemy champion, from the ally's perspective
 *             (analyzeMatchups later averages a matchup with its mirror).
 *  - synergy: every within-team pair, recorded from both champions' perspectives.
 *
 * Every count is symmetric across the two teams: each game contributes to the
 * winning side's wins and both sides' games.
 */
export function aggregateProGames(
    matches: ProMatch[],
    options: AggregateOptions = {},
): ProAggregate {
    const agg = createEmptyAggregate();

    for (const match of matches) {
        if (options.filter && !options.filter(match)) continue;

        const blueWon = match.winner === "blue";
        addTeam(agg, match.bluePicks, match.redPicks, blueWon);
        addTeam(agg, match.redPicks, match.bluePicks, !blueWon);
    }

    return agg;
}

function addTeam(
    agg: ProAggregate,
    allies: ProPick[],
    enemies: ProPick[],
    won: boolean,
): void {
    // base
    for (const p of allies) {
        bump(baseCell(agg, p.championKey, p.role), won);
    }

    // matchup: ally vs each enemy (ally perspective)
    for (const ally of allies) {
        for (const enemy of enemies) {
            bump(
                matchupCell(
                    agg,
                    ally.championKey,
                    ally.role,
                    enemy.role,
                    enemy.championKey,
                ),
                won,
            );
        }
    }

    // synergy: every within-team pair, both directions
    for (let i = 0; i < allies.length; i++) {
        for (let j = i + 1; j < allies.length; j++) {
            const a = allies[i];
            const b = allies[j];
            bump(synergyCell(agg, a.championKey, a.role, b.role, b.championKey), won);
            bump(synergyCell(agg, b.championKey, b.role, a.role, a.championKey), won);
        }
    }
}

function bump(cell: Counts, won: boolean): void {
    cell.games++;
    if (won) cell.wins++;
}

function baseCell(agg: ProAggregate, champ: string, role: Role): Counts {
    const byRole = (agg.base[champ] ??= {} as Record<Role, Counts>);
    return (byRole[role] ??= { wins: 0, games: 0 });
}

function matchupCell(
    agg: ProAggregate,
    champ: string,
    allyRole: Role,
    enemyRole: Role,
    enemyChamp: string,
): Counts {
    const byAllyRole = (agg.matchup[champ] ??= {} as Record<
        Role,
        Record<Role, Record<string, Counts>>
    >);
    const byEnemyRole = (byAllyRole[allyRole] ??= {} as Record<
        Role,
        Record<string, Counts>
    >);
    const byEnemyChamp = (byEnemyRole[enemyRole] ??= {});
    return (byEnemyChamp[enemyChamp] ??= { wins: 0, games: 0 });
}

function synergyCell(
    agg: ProAggregate,
    champ: string,
    role: Role,
    partnerRole: Role,
    partnerChamp: string,
): Counts {
    const byRole = (agg.synergy[champ] ??= {} as Record<
        Role,
        Record<Role, Record<string, Counts>>
    >);
    const byPartnerRole = (byRole[role] ??= {} as Record<
        Role,
        Record<string, Counts>
    >);
    const byPartnerChamp = (byPartnerRole[partnerRole] ??= {});
    return (byPartnerChamp[partnerChamp] ??= { wins: 0, games: 0 });
}
