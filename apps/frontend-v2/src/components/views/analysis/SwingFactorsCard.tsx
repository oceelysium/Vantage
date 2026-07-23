import { Component, createMemo, For, Show } from "solid-js";
import { Team } from "@draftgap/core/src/models/Team";
import { useDraftAnalysis } from "../../../contexts/DraftAnalysisContext";
import { useDataset } from "../../../contexts/DatasetContext";
import { useUser } from "../../../contexts/UserContext";
import { ratingToWinrate } from "@draftgap/core/src/rating/ratings";
import { ROLES, displayNameByRole } from "@draftgap/core/src/models/Role";
import { cn } from "../../../utils/style";

interface Props {
    team: Team;
    class?: string;
}

interface SwingFactor {
    type: "positive" | "negative" | "neutral";
    title: string;
    description: string;
    impactText?: string;
}

export const SwingFactorsCard: Component<Props> = (props) => {
    const { config } = useUser();
    const { dataset } = useDataset();
    const {
        allyDraftAnalysis,
        opponentDraftAnalysis,
        allyTeamComp,
        opponentTeamComp,
    } = useDraftAnalysis();

    const draftResult = () =>
        props.team === "ally" ? allyDraftAnalysis() : opponentDraftAnalysis();

    const teamComp = () =>
        props.team === "ally" ? allyTeamComp() : opponentTeamComp();

    const champName = (key: string) =>
        dataset()?.championData[key]?.name ?? key;

    const swingFactors = createMemo<SwingFactor[]>(() => {
        const result = draftResult();
        if (!result || !dataset()) return [];

        const factors: SwingFactor[] = [];
        const isAlly = props.team === "ally";

        // 1. Evaluate Overall Winrate Narrative
        const winratePct = result.winrate * 100;
        const totalRating = result.totalRating;
        const baseRating = config.ignoreChampionWinrates
            ? 0
            : result.allyChampionRating.totalRating;
        const matchupRating = result.matchupRating.totalRating;
        const duoRating = result.allyDuoRating.totalRating;

        if (winratePct >= 52.5) {
            if (baseRating > matchupRating && baseRating > duoRating) {
                factors.push({
                    type: "positive",
                    title: "Strong base win rates carry the draft",
                    description: `${
                        isAlly ? "Your" : "Opponent's"
                    } champion pool has high meta win rates overall.`,
                    impactText: `+${(
                        (ratingToWinrate(baseRating) - 0.5) *
                        100
                    ).toFixed(1)}%`,
                });
            } else if (matchupRating >= baseRating && matchupRating >= duoRating) {
                factors.push({
                    type: "positive",
                    title: "Counter-pick advantage in lane matchups",
                    description: `Favorable lane matchups drive the draft advantage.`,
                    impactText: `+${(
                        (ratingToWinrate(matchupRating) - 0.5) *
                        100
                    ).toFixed(1)}%`,
                });
            } else {
                factors.push({
                    type: "positive",
                    title: "Strong duo synergy across roles",
                    description: `High synergy pairing bonuses boost team execution.`,
                    impactText: `+${(
                        (ratingToWinrate(duoRating) - 0.5) *
                        100
                    ).toFixed(1)}%`,
                });
            }
        } else if (winratePct <= 47.5) {
            if (matchupRating < baseRating && matchupRating < duoRating) {
                factors.push({
                    type: "negative",
                    title: "Lane matchups are losing",
                    description: `Multiple roles face disadvantageous lane counters.`,
                    impactText: `${(
                        (ratingToWinrate(matchupRating) - 0.5) *
                        100
                    ).toFixed(1)}%`,
                });
            } else {
                factors.push({
                    type: "negative",
                    title: "Meta win rate deficit",
                    description: `Selected champions have lower baseline win rates into this comp.`,
                    impactText: `${(
                        (ratingToWinrate(totalRating) - 0.5) *
                        100
                    ).toFixed(1)}%`,
                });
            }
        }

        // 2. Identify Top Single Matchup Counter
        const headToHeadMatchups = result.matchupRating.matchupResults.filter(
            (m) => m.roleA === m.roleB,
        );
        if (headToHeadMatchups.length > 0) {
            const sortedMatchups = [...headToHeadMatchups].sort(
                (a, b) => Math.abs(b.rating) - Math.abs(a.rating),
            );
            const topMatchup = sortedMatchups[0];
            const deltaPct = (ratingToWinrate(topMatchup.rating) - 0.5) * 100;

            if (deltaPct <= -1.5) {
                factors.push({
                    type: "negative",
                    title: `${displayNameByRole[topMatchup.roleA]} lane hard-countered`,
                    description: `${champName(topMatchup.championKeyA)} struggles into ${champName(
                        topMatchup.championKeyB,
                    )} (${(ratingToWinrate(topMatchup.rating) * 100).toFixed(1)}% matchup wr).`,
                    impactText: `${deltaPct.toFixed(1)}%`,
                });
            } else if (deltaPct >= 1.5) {
                factors.push({
                    type: "positive",
                    title: `${displayNameByRole[topMatchup.roleA]} lane counter-pick win`,
                    description: `${champName(topMatchup.championKeyA)} heavy advantage over ${champName(
                        topMatchup.championKeyB,
                    )} (${(ratingToWinrate(topMatchup.rating) * 100).toFixed(1)}% matchup wr).`,
                    impactText: `+${deltaPct.toFixed(1)}%`,
                });
            }
        }

        // 3. Top Duo Synergy
        const duoResults = result.allyDuoRating.duoResults;
        if (duoResults.length > 0) {
            const sortedDuos = [...duoResults].sort(
                (a, b) => Math.abs(b.rating) - Math.abs(a.rating),
            );
            const topDuo = sortedDuos[0];
            const duoDeltaPct = (ratingToWinrate(topDuo.rating) - 0.5) * 100;

            if (duoDeltaPct >= 1.2) {
                factors.push({
                    type: "positive",
                    title: `${displayNameByRole[topDuo.roleA]} + ${displayNameByRole[topDuo.roleB]} synergy`,
                    description: `${champName(topDuo.championKeyA)} and ${champName(
                        topDuo.championKeyB,
                    )} have strong synergy pairing (${(ratingToWinrate(topDuo.rating) * 100).toFixed(1)}% duo wr).`,
                    impactText: `+${duoDeltaPct.toFixed(1)}%`,
                });
            }
        }

        // Fallback default if draft is initial / evenly matched
        if (factors.length === 0) {
            factors.push({
                type: "neutral",
                title: "Draft is evenly balanced",
                description: "Neither team holds a decisive tactical advantage yet.",
                impactText: "±0.0%",
            });
        }

        return factors;
    });

    return (
        <div
            class={cn(
                "p-5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 shadow-md flex flex-col justify-between",
                props.class,
            )}
        >
            <div>
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-xs font-title font-bold uppercase tracking-wider text-neutral-400">
                        Swing Factors
                    </h3>
                    <span class="text-[10px] text-neutral-500 font-title uppercase">
                        What's Moving It
                    </span>
                </div>

                <div class="space-y-2.5">
                    <For each={swingFactors()}>
                        {(factor) => (
                            <div
                                class={cn(
                                    "p-3 rounded-lg border-l-3 bg-neutral-950/60 border border-y-neutral-800/40 border-r-neutral-800/40 flex items-start justify-between gap-3 transition-all",
                                    factor.type === "positive"
                                        ? "border-l-emerald-500"
                                        : factor.type === "negative"
                                        ? "border-l-rose-500"
                                        : "border-l-neutral-600",
                                )}
                            >
                                <div>
                                    <div class="text-xs font-title font-semibold text-neutral-200">
                                        {factor.title}
                                    </div>
                                    <p class="text-[11px] text-neutral-400 font-body mt-0.5 leading-snug">
                                        {factor.description}
                                    </p>
                                </div>
                                <Show when={factor.impactText}>
                                    <span
                                        class={cn(
                                            "text-xs font-title font-bold shrink-0 font-mono px-1.5 py-0.5 rounded",
                                            factor.type === "positive"
                                                ? "text-emerald-400 bg-emerald-950/40"
                                                : factor.type === "negative"
                                                ? "text-rose-400 bg-rose-950/40"
                                                : "text-neutral-400 bg-neutral-800/40",
                                        )}
                                    >
                                        {factor.impactText}
                                    </span>
                                </Show>
                            </div>
                        )}
                    </For>
                </div>
            </div>
        </div>
    );
};
