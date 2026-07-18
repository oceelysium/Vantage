import type {
    Dataset,
    ProMeta,
} from "@draftgap/core/src/models/dataset/Dataset";
import type { ChampionRoleData } from "@draftgap/core/src/models/dataset/ChampionRoleData";
import { ROLES, type Role } from "@draftgap/core/src/models/Role";
import type { Counts, ProAggregate, ProMatch } from "./types";
import {
    type BlendConfig,
    blendCell,
    priorBaseWinrate,
    priorMatchupWinrate,
    priorSynergyWinrate,
} from "./blend";

export type BuildProDatasetOptions = {
    blend: BlendConfig;
    /** Overrides for dataset metadata; defaults keep the prior version + now(). */
    version?: string;
    date?: string;
};

/**
 * Assemble a pro-calibrated Dataset by taking the soloqueue prior and overlaying
 * blended pro statistics.
 *
 * Design: clone the prior, then for every champion-role blend the base winrate and
 * overwrite any matchup/synergy cell that was actually observed in pro. Cells with
 * no pro observation are carried through from the prior unchanged (which is exactly
 * "pro games = 0 -> prior"). Build data, damage profiles, statsByTime and all the
 * static item/rune/spell tables come through the clone untouched.
 *
 * Pure: does no I/O and does not mutate `prior`. removeRankBias() is applied by the
 * caller (pro-index) to match the soloqueue pipeline.
 */
export function buildProDataset(
    prior: Dataset,
    aggregate: ProAggregate,
    options: BuildProDatasetOptions,
): Dataset {
    const { blend } = options;
    const dataset: Dataset = structuredClone(prior);
    dataset.version = options.version ?? prior.version;
    dataset.date = options.date ?? new Date().toISOString();

    for (const [championKey, championData] of Object.entries(
        dataset.championData,
    )) {
        for (const role of ROLES) {
            const roleData = championData.statsByRole[role];
            if (!roleData) continue;

            // --- base ---
            const proBase: Counts = aggregate.base[championKey]?.[role] ?? {
                wins: 0,
                games: 0,
            };
            const blendedBase = blendCell(
                proBase,
                priorBaseWinrate(prior, championKey, role),
                blend,
            );
            roleData.games = blendedBase.games;
            roleData.wins = blendedBase.wins;

            // --- matchups observed in pro ---
            const proMatchByEnemyRole = aggregate.matchup[championKey]?.[role];
            if (proMatchByEnemyRole) {
                for (const enemyRole of ROLES) {
                    const byEnemyChamp = proMatchByEnemyRole[enemyRole];
                    if (!byEnemyChamp) continue;
                    for (const [enemyChamp, proCell] of Object.entries(
                        byEnemyChamp,
                    )) {
                        const blended = blendCell(
                            proCell,
                            priorMatchupWinrate(
                                prior,
                                championKey,
                                role,
                                enemyRole,
                                enemyChamp,
                            ),
                            blend,
                        );
                        setCell(roleData.matchup, enemyRole, enemyChamp, blended);
                    }
                }
            }

            // --- synergies observed in pro ---
            const proSynByPartnerRole = aggregate.synergy[championKey]?.[role];
            if (proSynByPartnerRole) {
                for (const partnerRole of ROLES) {
                    const byPartnerChamp = proSynByPartnerRole[partnerRole];
                    if (!byPartnerChamp) continue;
                    for (const [partnerChamp, proCell] of Object.entries(
                        byPartnerChamp,
                    )) {
                        const blended = blendCell(
                            proCell,
                            priorSynergyWinrate(
                                prior,
                                championKey,
                                role,
                                partnerRole,
                                partnerChamp,
                            ),
                            blend,
                        );
                        setCell(
                            roleData.synergy,
                            partnerRole,
                            partnerChamp,
                            blended,
                        );
                    }
                }
            }
        }
    }

    return dataset;
}

/** Summarise the provenance/scope of the pro matches that fed a build. */
export function computeProMeta(
    matches: ProMatch[],
    priorGames: number,
): ProMeta {
    const patches = [
        ...new Set(matches.map((m) => m.patch).filter(Boolean)),
    ].sort();
    const leagues = [
        ...new Set(matches.map((m) => m.league).filter(Boolean)),
    ].sort();
    return {
        matches: matches.length,
        patches,
        leagues,
        builtAt: new Date().toISOString(),
        priorGames,
    };
}

/** Write a blended {championKey, wins, games} into a matchup/synergy table. */
function setCell(
    table: ChampionRoleData["matchup"] | ChampionRoleData["synergy"],
    role: Role,
    championKey: string,
    counts: Counts,
): void {
    const byChamp = (table[role] ??= {});
    byChamp[championKey] = {
        championKey,
        games: counts.games,
        wins: counts.wins,
    };
}
