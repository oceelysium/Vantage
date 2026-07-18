import { Role, ROLES } from "../models/Role";
import { Dataset } from "../models/dataset/Dataset";
import { DraftResult, AnalyzeDraftConfig, analyzeDraft } from "./analysis";
import { getStats } from "./utils";

export interface Suggestion {
    championKey: string;
    role: Role;
    draftResult: DraftResult;
}

export function getSuggestions(
    dataset: Dataset,
    synergyMatchupDataset: Dataset,
    team: Map<Role, string>,
    enemy: Map<Role, string>,
    config: AnalyzeDraftConfig,
    /**
     * Champions to include in every role regardless of sample size. Used to
     * surface an explicitly searched-for champion (e.g. an off-meta pick like
     * Urgot support) that the min-games filter would otherwise hide.
     */
    alwaysIncludeChampions?: Set<string>,
) {
    const remainingRoles = ROLES.filter((role) => !team.has(role));
    const enemyChampions = new Set(enemy.values());
    const allyChampions = new Set(team.values());

    const suggestions: Suggestion[] = [];

    for (const championKey of Object.keys(dataset.championData)) {
        if (enemyChampions.has(championKey) || allyChampions.has(championKey))
            continue;

        const forceInclude = alwaysIncludeChampions?.has(championKey) ?? false;

        for (const role of remainingRoles) {
            if (team.has(role)) continue;

            const rawGames = getStats(
                synergyMatchupDataset,
                championKey,
                role,
            ).games;
            // Pro: compare the true pro sample (games - k) directly.
            // Soloq (default): scale 30-day games to a ~7-day estimate.
            const filterGames =
                config.scaleGamesToWeek === false
                    ? rawGames - (config.gamesOffset ?? 0)
                    : (rawGames / 30) * 7;
            if (!forceInclude && filterGames < config.minGames) continue;

            team.set(role, championKey);
            const draftResult = analyzeDraft(
                dataset,
                synergyMatchupDataset,
                team,
                enemy,
                config,
            );
            team.delete(role);

            suggestions.push({
                championKey,
                role,
                draftResult,
            });
        }
    }

    return suggestions.sort(
        (a, b) => b.draftResult.winrate - a.draftResult.winrate,
    );
}
