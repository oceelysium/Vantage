import {
    ratingToWinrate,
    winrateToRating,
} from "@draftgap/core/src/rating/ratings";
import type { Dataset } from "@draftgap/core/src/models/dataset/Dataset";
import type { Role } from "@draftgap/core/src/models/Role";
import type { Counts } from "./types";

export type BlendConfig = {
    /**
     * Prior strength in pseudo-games (k). Higher = trust the soloqueue prior more;
     * lower = trust the sparse pro sample more. Tuned by the M5 backtest, and
     * independent of the runtime user-facing risk level.
     */
    priorGames: number;
    /**
     * true  -> shrink on the Elo/rating (log-odds) scale (preferred; consistent
     *          with how packages/core reasons about winrates).
     * false -> Beta-Binomial shrinkage in raw winrate space.
     */
    ratingScale: boolean;
};

/** Keep a winrate strictly inside (0, 1) so Elo conversions stay finite. */
export function clampWinrate(w: number, eps = 1e-6): number {
    if (!Number.isFinite(w)) return 0.5;
    return Math.min(1 - eps, Math.max(eps, w));
}

/**
 * Blend a sparse pro win/game count with a soloqueue prior winrate, returning an
 * effective {wins, games} on the pro sample size so downstream code (analyzeDraft)
 * is unchanged.
 *
 * Behaviour:
 *  - pro.games === 0  -> result winrate == priorWinrate (fully shrunk to prior)
 *  - k === 0          -> pure pro estimate (no shrinkage)
 *  - pro.games -> inf -> result winrate -> pro winrate
 */
export function blendCell(
    pro: Counts,
    priorWinrate: number,
    cfg: BlendConfig,
): Counts {
    const k = cfg.priorGames;
    if (k <= 0) return { wins: pro.wins, games: pro.games };

    if (!cfg.ratingScale) {
        // Beta-Binomial: add k pseudo-games at the prior winrate.
        return { wins: pro.wins + k * priorWinrate, games: pro.games + k };
    }

    // Rating-space, precision-weighted blend of Elo ratings.
    const proWr = pro.games > 0 ? pro.wins / pro.games : priorWinrate;
    const rPrior = winrateToRating(clampWinrate(priorWinrate));
    const rPro = winrateToRating(clampWinrate(proWr));
    const alpha = pro.games / (pro.games + k); // weight on the pro estimate
    const blendedWr = ratingToWinrate(alpha * rPro + (1 - alpha) * rPrior);
    const games = pro.games + k;
    return { wins: blendedWr * games, games };
}

/* ------------------------------------------------------------------ */
/* Prior-winrate readers: pull the soloqueue winrate for a given cell. */
/* Each falls back gracefully when the prior cell is empty.            */
/* ------------------------------------------------------------------ */

/** Soloqueue base winrate for a champion in a role (0.5 when unknown). */
export function priorBaseWinrate(
    prior: Dataset,
    championKey: string,
    role: Role,
): number {
    const roleData = prior.championData[championKey]?.statsByRole?.[role];
    if (roleData && roleData.games > 0) return roleData.wins / roleData.games;
    return 0.5;
}

/** Soloqueue matchup winrate (ally vs enemy), falling back to the ally's base rate. */
export function priorMatchupWinrate(
    prior: Dataset,
    championKey: string,
    allyRole: Role,
    enemyRole: Role,
    enemyChampionKey: string,
): number {
    const roleData = prior.championData[championKey]?.statsByRole?.[allyRole];
    const cell = roleData?.matchup?.[enemyRole]?.[enemyChampionKey];
    if (cell && cell.games > 0) return cell.wins / cell.games;
    return priorBaseWinrate(prior, championKey, allyRole);
}

/** Soloqueue synergy winrate (duo), falling back to the champion's base rate. */
export function priorSynergyWinrate(
    prior: Dataset,
    championKey: string,
    role: Role,
    partnerRole: Role,
    partnerChampionKey: string,
): number {
    const roleData = prior.championData[championKey]?.statsByRole?.[role];
    const cell = roleData?.synergy?.[partnerRole]?.[partnerChampionKey];
    if (cell && cell.games > 0) return cell.wins / cell.games;
    return priorBaseWinrate(prior, championKey, role);
}
