import { Component, createMemo, For, Show } from "solid-js";
import { Team } from "@draftgap/core/src/models/Team";
import { Role } from "@draftgap/core/src/models/Role";
import { useDraftAnalysis } from "../../../contexts/DraftAnalysisContext";
import { useUser } from "../../../contexts/UserContext";
import { ratingToWinrate } from "@draftgap/core/src/rating/ratings";
import ChampionCell from "../../common/ChampionCell";
import { RoleCell } from "../../common/RoleCell";
import { RatingText } from "../../common/RatingText";
import { cn } from "../../../utils/style";

interface Props {
    team: Team;
    onClickChampion?: (championKey: string) => void;
    class?: string;
}

interface ChampionImpact {
    role: Role;
    championKey: string;
    baseRating: number;
    duoRating: number;
    matchupRating: number;
    totalRating: number;
    deltaPct: number;
}

export const ChampionContributionBars: Component<Props> = (props) => {
    const { config } = useUser();
    const {
        allyDraftAnalysis,
        opponentDraftAnalysis,
        allyTeamComp,
        opponentTeamComp,
    } = useDraftAnalysis();

    const draftResult = () =>
        props.team === "ally" ? allyDraftAnalysis() : opponentDraftAnalysis();

    const isAlly = () => props.team === "ally";

    const championImpacts = createMemo<ChampionImpact[]>(() => {
        const result = draftResult();
        if (!result) return [];

        const comp = props.team === "ally" ? allyTeamComp() : opponentTeamComp();
        const champions = [...comp.entries()].map(([role, key]) => ({
            role,
            championKey: key,
        }));

        const championResults =
            result.allyChampionRating?.championResults ?? [];
        const duoResults = result.allyDuoRating?.duoResults ?? [];
        const matchupResults = result.matchupRating?.matchupResults ?? [];

        const impacts = champions.map(({ role, championKey }) => {
            const champRes = championResults.find(
                (r) => r.championKey === championKey,
            );
            const baseRating = config.ignoreChampionWinrates
                ? 0
                : champRes?.rating ?? 0;

            const matchupRating = matchupResults
                .filter((r) => r.championKeyA === championKey)
                .reduce((sum, r) => sum + r.rating, 0);

            const duoRating = duoResults
                .filter(
                    (r) =>
                        r.championKeyA === championKey ||
                        r.championKeyB === championKey,
                )
                .reduce((sum, r) => sum + r.rating / 2, 0);

            const totalRating = baseRating + matchupRating + duoRating;
            const deltaPct = (ratingToWinrate(totalRating) - 0.5) * 100;

            return {
                role,
                championKey,
                baseRating,
                duoRating,
                matchupRating,
                totalRating,
                deltaPct,
            };
        });

        // Sort by impact descending (highest positive impact on top)
        return impacts.sort((a, b) => b.deltaPct - a.deltaPct);
    });

    // Compute maximum absolute delta to scale diverging bars nicely
    const maxAbsDelta = createMemo(() => {
        const max = Math.max(
            ...championImpacts().map((c) => Math.abs(c.deltaPct)),
            2.5, // Minimum scale threshold so small deltas look proportioned
        );
        return max;
    });

    return (
        <div
            class={cn(
                "p-5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 shadow-md",
                props.class,
            )}
        >
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="text-xs font-title font-bold uppercase tracking-wider text-neutral-400">
                        Champion Impact Breakdown
                    </h3>
                    <p class="text-[11px] text-neutral-500 font-body mt-0.5">
                        Net winrate contribution ranked from carrying to liability
                    </p>
                </div>
                <div class="flex items-center gap-3 text-[10px] font-title uppercase text-neutral-400">
                    <span class="flex items-center gap-1">
                        <span class="w-2 h-2 rounded bg-emerald-500" />
                        Raises Winrate
                    </span>
                    <span class="flex items-center gap-1">
                        <span class="w-2 h-2 rounded bg-rose-500" />
                        Lowers Winrate
                    </span>
                </div>
            </div>

            {/* Impact List */}
            <div class="space-y-3">
                <For each={championImpacts()}>
                    {(champ) => {
                        const positive = champ.deltaPct >= 0;
                        // Bar percentage normalized to half-width of container (0-50%)
                        const barWidthPct = Math.min(
                            50,
                            (Math.abs(champ.deltaPct) / maxAbsDelta()) * 50,
                        );

                        return (
                            <div
                                onClick={() =>
                                    props.onClickChampion?.(champ.championKey)
                                }
                                class="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/60 hover:border-neutral-700 transition cursor-pointer group"
                            >
                                {/* Top Row: Role, Champion, Chips & Delta */}
                                <div class="flex items-center justify-between gap-2 mb-2">
                                    <div class="flex items-center gap-2">
                                        <RoleCell role={champ.role} />
                                        <ChampionCell
                                            championKey={champ.championKey}
                                            nameMaxLength={12}
                                        />
                                    </div>

                                    {/* Breakdown Chips */}
                                    <div class="flex items-center gap-2">
                                        <div class="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-neutral-400">
                                            <Show
                                                when={
                                                    !config.ignoreChampionWinrates
                                                }
                                            >
                                                <span
                                                    class="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800"
                                                    title="Base champion winrate"
                                                >
                                                    Base:{" "}
                                                    <RatingText
                                                        rating={champ.baseRating}
                                                    />
                                                </span>
                                            </Show>
                                            <span
                                                class="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800"
                                                title="Matchup advantage sum"
                                            >
                                                Matchup:{" "}
                                                <RatingText
                                                    rating={champ.matchupRating}
                                                />
                                            </span>
                                            <span
                                                class="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800"
                                                title="Duo synergy sum"
                                            >
                                                Duo:{" "}
                                                <RatingText
                                                    rating={champ.duoRating}
                                                />
                                            </span>
                                        </div>

                                        <span
                                            class={cn(
                                                "text-xs font-title font-bold font-mono px-2 py-0.5 rounded min-w-[54px] text-right",
                                                positive
                                                    ? "text-emerald-400 bg-emerald-950/40 border border-emerald-500/30"
                                                    : "text-rose-400 bg-rose-950/40 border border-rose-500/30",
                                            )}
                                        >
                                            {positive ? "+" : ""}
                                            {champ.deltaPct.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>

                                {/* Diverging Impact Bar */}
                                <div class="relative h-2 bg-neutral-900 rounded overflow-hidden flex items-center">
                                    {/* Center 50% divider line */}
                                    <div class="absolute left-1/2 top-0 bottom-0 w-px bg-neutral-700 z-10" />

                                    {/* Bar Fill */}
                                    <Show
                                        when={positive}
                                        fallback={
                                            <div
                                                class="absolute right-1/2 h-full bg-rose-500/80 rounded-l transition-all duration-300"
                                                style={{
                                                    width: `${barWidthPct}%`,
                                                }}
                                            />
                                        }
                                    >
                                        <div
                                            class="absolute left-1/2 h-full bg-emerald-500/80 rounded-r transition-all duration-300"
                                            style={{ width: `${barWidthPct}%` }}
                                        />
                                    </Show>
                                </div>
                            </div>
                        );
                    }}
                </For>
            </div>
        </div>
    );
};
