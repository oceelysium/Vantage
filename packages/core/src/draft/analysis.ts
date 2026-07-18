import { defaultChampionRoleData } from "../models/dataset/ChampionRoleData";
import { Dataset } from "../models/dataset/Dataset";
import { Role } from "../models/Role";
import { winrateToRating, ratingToWinrate } from "../rating/ratings";
import { RiskLevel, priorGamesByRiskLevel } from "../risk/risk-level";
import { addStats, averageStats } from "../stats";
import { getStats } from "./utils";

/**
 * Inverse sampling variance of a smoothed winrate estimate on the winrate scale
 * (a Fisher-information term). Summed across the cells feeding a prediction, it
 * yields the predicted winrate's variance — larger for thin, per-cell samples.
 */
function infoTerm(winrate: number, effectiveGames: number): number {
    const p = Math.min(1 - 1e-6, Math.max(1e-6, winrate));
    return 1 / (p * (1 - p) * Math.max(effectiveGames, 1e-6));
}

export type DraftResult = {
    allyChampionRating: AnalyzeChampionsResult;
    enemyChampionRating: AnalyzeChampionsResult;
    allyDuoRating: AnalyzeDuosResult;
    enemyDuoRating: AnalyzeDuosResult;
    matchupRating: AnalyzeMatchupsResult;

    totalRating: number;
    winrate: number;
    /** One standard error of the predicted winrate, from per-cell sample sizes. */
    winrateStdError: number;
};

export interface AnalyzeDraftConfig {
    ignoreChampionWinrates: boolean;
    riskLevel: RiskLevel;
    minGames: number;
    /**
     * When true (default) the suggestions filter scales 30-day games to a ~7-day
     * estimate (soloqueue behaviour). Set false for pro data, where games counts
     * are already small and should be compared directly.
     */
    scaleGamesToWeek?: boolean;
    /**
     * Games to subtract before the suggestions filter compares against minGames.
     * For pro datasets this is the prior pseudo-count (k), so the filter operates
     * on the true pro sample size rather than the blended total.
     */
    gamesOffset?: number;
}

export function analyzeDraft(
    dataset: Dataset,
    fullDataset: Dataset,
    team: Map<Role, string>,
    enemy: Map<Role, string>,
    config: AnalyzeDraftConfig,
): DraftResult {
    const priorGames = priorGamesByRiskLevel[config.riskLevel];

    const allyChampionRating = !config.ignoreChampionWinrates
        ? analyzeChampions(dataset, fullDataset, team, priorGames)
        : { totalRating: 0, winrate: 0, championResults: [], totalInfo: 0 };
    const enemyChampionRating = !config.ignoreChampionWinrates
        ? analyzeChampions(dataset, fullDataset, enemy, priorGames)
        : { totalRating: 0, winrate: 0, championResults: [], totalInfo: 0 };

    const allyDuoRating = analyzeDuos(fullDataset, team, priorGames);
    const enemyDuoRating = analyzeDuos(fullDataset, enemy, priorGames);
    const matchupRating = analyzeMatchups(fullDataset, team, enemy, priorGames);

    const totalRating =
        allyChampionRating.totalRating +
        allyDuoRating.totalRating +
        matchupRating.totalRating -
        enemyChampionRating.totalRating -
        enemyDuoRating.totalRating;

    const winrate = ratingToWinrate(totalRating);

    const totalInfo =
        allyChampionRating.totalInfo +
        enemyChampionRating.totalInfo +
        allyDuoRating.totalInfo +
        enemyDuoRating.totalInfo +
        matchupRating.totalInfo;
    // Aggregate sampling uncertainty of the predicted winrate (1 standard error).
    const winrateStdError = winrate * (1 - winrate) * Math.sqrt(totalInfo);

    return {
        allyChampionRating,
        enemyChampionRating,
        allyDuoRating,
        enemyDuoRating,
        matchupRating,
        totalRating,
        winrate,
        winrateStdError,
    };
}

export type AnalyzeChampionResult = {
    role: Role;
    championKey: string;
    rating: number;
    wins: number;
    games: number;
    info: number;
};

export type AnalyzeChampionsResult = {
    championResults: AnalyzeChampionResult[];
    totalRating: number;
    totalInfo: number;
};

export function analyzeChampions(
    dataset: Dataset,
    synergyMatchupDataset: Dataset,
    team: Map<Role, string>,
    priorGames: number,
): AnalyzeChampionsResult {
    const championResults: AnalyzeChampionResult[] = [];
    let totalRating = 0;
    let totalInfo = 0;

    for (const [role, championKey] of team) {
        const championResult = analyzeChampion(
            dataset,
            synergyMatchupDataset,
            role,
            championKey,
            priorGames,
        );

        championResults.push(championResult);
        totalRating += championResult.rating;
        totalInfo += championResult.info;
    }

    return {
        championResults,
        totalRating,
        totalInfo,
    };
}

export function analyzeChampion(
    dataset: Dataset,
    fullDataset: Dataset,
    role: Role,
    championKey: string,
    priorGames: number,
) {
    // Get stats for this patch
    const championData = dataset.championData[championKey];
    const roleData = championData.statsByRole[role];

    // Get stats for the full dataset (30days)
    const fullChampionData = fullDataset.championData[championKey] ?? {
        ...championData,
        statsByRole: {
            0: defaultChampionRoleData(),
            1: defaultChampionRoleData(),
            2: defaultChampionRoleData(),
            3: defaultChampionRoleData(),
            4: defaultChampionRoleData(),
        },
    };
    const fullChampionRoleData = fullChampionData.statsByRole[role];
    const fullChampionRoleWinrate =
        fullChampionRoleData.games === 0
            ? 0.5
            : fullChampionRoleData.wins / fullChampionRoleData.games;

    const stats = addStats(
        {
            wins: roleData.wins,
            games: roleData.games,
        },
        // Scale prior stats by winrate of expected rating, as we expect the champion to have a similar winrate to the expected rating
        // We estimate the expected rating to be the rank winrate
        {
            wins: priorGames * fullChampionRoleWinrate,
            games: priorGames,
        },
        // TOOD: if 30 days has no games, add other prior games
    );

    const smoothedWinrate = stats.wins / stats.games;
    const rating = winrateToRating(smoothedWinrate);

    return {
        role,
        championKey,
        rating,
        wins: roleData.wins,
        games: roleData.games,
        info: infoTerm(smoothedWinrate, stats.games),
    };
}

export type AnalyzeDuoResult = {
    roleA: Role;
    championKeyA: string;
    roleB: Role;
    championKeyB: string;
    rating: number;
    wins: number;
    games: number;
};

export type AnalyzeDuosResult = {
    duoResults: AnalyzeDuoResult[];
    totalRating: number;
    totalInfo: number;
};

export function analyzeDuos(
    dataset: Dataset,
    team: Map<Role, string>,
    priorGames: number,
): AnalyzeDuosResult {
    const teamEntries = Array.from(team.entries()).sort((a, b) => a[0] - b[0]);

    const duoResults: AnalyzeDuoResult[] = [];
    let totalRating = 0;
    let totalInfo = 0;

    for (let i = 0; i < teamEntries.length; i++) {
        for (let j = i + 1; j < teamEntries.length; j++) {
            const [role, championKey] = teamEntries[i];
            const [role2, championKey2] = teamEntries[j];
            const roleStats = getStats(dataset, championKey, role);
            const champion2RoleStats = getStats(dataset, championKey2, role2);
            const expectedRating =
                winrateToRating(
                    roleStats.games === 0
                        ? 0.5
                        : roleStats.wins / roleStats.games,
                ) +
                winrateToRating(
                    champion2RoleStats.games === 0
                        ? 0.5
                        : champion2RoleStats.wins / champion2RoleStats.games,
                );
            const expectedWinrate = ratingToWinrate(expectedRating);

            const duoStats = getStats(
                dataset,
                championKey,
                role,
                "duo",
                role2,
                championKey2,
            );
            const champion2DuoStats = getStats(
                dataset,
                championKey2,
                role2,
                "duo",
                role,
                championKey,
            );
            const combinedStats = averageStats(duoStats, champion2DuoStats);

            const adjustedStats = addStats(combinedStats, {
                wins: priorGames * expectedWinrate,
                games: priorGames,
            });
            const winrate = adjustedStats.wins / adjustedStats.games;

            const actualRating = winrateToRating(winrate);
            const rating = actualRating - expectedRating;

            duoResults.push({
                roleA: role,
                championKeyA: championKey,
                roleB: role2,
                championKeyB: championKey2,
                rating,
                wins:
                    ratingToWinrate(
                        winrateToRating(
                            combinedStats.wins / combinedStats.games,
                        ) - expectedRating,
                    ) * combinedStats.games,
                games: combinedStats.games,
            });
            totalRating += rating;
            totalInfo += infoTerm(winrate, adjustedStats.games);
        }
    }

    return {
        duoResults,
        totalRating,
        totalInfo,
    };
}

export type AnalyzeMatchupResult = {
    roleA: Role;
    championKeyA: string;
    roleB: Role;
    championKeyB: string;
    rating: number;
    wins: number;
    games: number;
};

export type AnalyzeMatchupsResult = {
    matchupResults: AnalyzeMatchupResult[];
    totalRating: number;
    totalInfo: number;
};

export function analyzeMatchups(
    dataset: Dataset,
    team: Map<Role, string>,
    enemy: Map<Role, string>,
    priorGames: number,
): AnalyzeMatchupsResult {
    const matchupResults: AnalyzeMatchupResult[] = [];
    let totalRating = 0;
    let totalInfo = 0;

    for (const [allyRole, allyChampionKey] of team) {
        for (const [enemyRole, enemyChampionKey] of enemy) {
            const roleStats = getStats(dataset, allyChampionKey, allyRole);
            const enemyRoleStats = getStats(
                dataset,
                enemyChampionKey,
                enemyRole,
            );

            const expectedRating =
                winrateToRating(
                    roleStats.games === 0
                        ? 0.5
                        : roleStats.wins / roleStats.games,
                ) -
                winrateToRating(
                    enemyRoleStats.games === 0
                        ? 0.5
                        : enemyRoleStats.wins / enemyRoleStats.games,
                );
            const expectedWinrate = ratingToWinrate(expectedRating);

            const matchupStats = getStats(
                dataset,
                allyChampionKey,
                allyRole,
                "matchup",
                enemyRole,
                enemyChampionKey,
            );
            const enemyMatchupStats = getStats(
                dataset,
                enemyChampionKey,
                enemyRole,
                "matchup",
                allyRole,
                allyChampionKey,
            );
            const enemyLosses =
                enemyMatchupStats.games - enemyMatchupStats.wins;

            const wins = (matchupStats.wins + enemyLosses) / 2;
            const games = (matchupStats.games + enemyMatchupStats.games) / 2;

            const adjustedStats = addStats(
                {
                    wins,
                    games,
                },
                {
                    wins: priorGames * expectedWinrate,
                    games: priorGames,
                },
            );
            const winrate = adjustedStats.wins / adjustedStats.games;

            const actualRating = winrateToRating(winrate);
            const rating = actualRating - expectedRating;

            matchupResults.push({
                roleA: allyRole,
                championKeyA: allyChampionKey,
                roleB: enemyRole,
                championKeyB: enemyChampionKey,
                rating,
                wins:
                    ratingToWinrate(
                        winrateToRating(wins / games) - expectedRating,
                    ) * games,
                games,
            });
            totalRating += rating;
            totalInfo += infoTerm(winrate, adjustedStats.games);
        }
    }

    return {
        matchupResults,
        totalRating,
        totalInfo,
    };
}
