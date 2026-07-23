import { Component, createMemo, For, Show } from "solid-js";
import { Team } from "@draftgap/core/src/models/Team";
import { ROLES, displayNameByRole } from "@draftgap/core/src/models/Role";
import { useDraftAnalysis } from "../../../contexts/DraftAnalysisContext";
import { ratingToWinrate } from "@draftgap/core/src/rating/ratings";
import ChampionCell from "../../common/ChampionCell";
import { RoleCell } from "../../common/RoleCell";
import { RatingText } from "../../common/RatingText";
import { cn } from "../../../utils/style";

interface Props {
    onClickChampion?: (team: Team, championKey: string) => void;
    class?: string;
}

export const LaneDuelsCard: Component<Props> = (props) => {
    const { allyDraftAnalysis, allyTeamComp, opponentTeamComp } =
        useDraftAnalysis();

    const allyComp = () => allyTeamComp();
    const opponentComp = () => opponentTeamComp();
    const matchupResults = () =>
        allyDraftAnalysis()?.matchupRating?.matchupResults ?? [];
    const duoResults = () =>
        allyDraftAnalysis()?.allyDuoRating?.duoResults ?? [];

    const laneDuels = createMemo(() => {
        const matchups = matchupResults();
        const aComp = allyComp();
        const oComp = opponentComp();

        return ROLES.map((role) => {
            const allyKey = aComp.get(role);
            const oppKey = oComp.get(role);

            // Find head-to-head matchup result
            const matchup = matchups.find(
                (m) =>
                    m.roleA === role &&
                    m.roleB === role &&
                    m.championKeyA === allyKey &&
                    m.championKeyB === oppKey,
            );

            const rating = matchup?.rating ?? 0;
            const allyWinrate = ratingToWinrate(rating) * 100;
            const deltaPct = allyWinrate - 50;
            const games = matchup?.games ?? 0;

            return {
                role,
                allyKey,
                oppKey,
                rating,
                allyWinrate,
                deltaPct,
                games,
                hasBoth: !!(allyKey && oppKey),
            };
        });
    });

    const topDuos = createMemo(() => {
        const duos = duoResults();
        return [...duos]
            .sort((a, b) => Math.abs(b.rating) - Math.abs(a.rating))
            .slice(0, 4);
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
                        Lane Duels & Head-to-Heads
                    </h3>
                    <p class="text-[11px] text-neutral-500 font-body mt-0.5">
                        Direct role matchups and positional advantages
                    </p>
                </div>
                <div class="flex items-center gap-3 text-[10px] font-title uppercase">
                    <span class="text-ally font-bold">Ally Advantage</span>
                    <span class="text-neutral-500">•</span>
                    <span class="text-opponent font-bold">Enemy Advantage</span>
                </div>
            </div>

            {/* Role Duels Grid */}
            <div class="space-y-2.5">
                <For each={laneDuels()}>
                    {(duel) => {
                        const allyAdv = duel.deltaPct >= 0;
                        // Bar percentage balance (0 to 100% split point)
                        const barSplit = Math.max(
                            10,
                            Math.min(90, 50 + duel.deltaPct * 3),
                        );

                        return (
                            <div class="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/60">
                                <div class="flex items-center justify-between gap-2 mb-2">
                                    {/* Role Badge */}
                                    <div class="flex items-center gap-2">
                                        <RoleCell role={duel.role} />
                                        <span class="text-xs font-title font-bold text-neutral-300">
                                            {displayNameByRole[duel.role]}
                                        </span>
                                    </div>

                                    {/* Ally Champion */}
                                    <div class="flex items-center gap-2">
                                        <Show
                                            when={duel.allyKey}
                                            fallback={
                                                <span class="text-xs text-neutral-600 font-title italic">
                                                    Empty
                                                </span>
                                            }
                                        >
                                            <div
                                                onClick={() =>
                                                    props.onClickChampion?.(
                                                        "ally",
                                                        duel.allyKey!,
                                                    )
                                                }
                                                class="cursor-pointer hover:opacity-80 transition"
                                            >
                                                <ChampionCell
                                                    championKey={duel.allyKey!}
                                                    nameMaxLength={10}
                                                />
                                            </div>
                                        </Show>

                                        <span class="text-xs text-neutral-600 font-bold px-1">
                                            VS
                                        </span>

                                        {/* Enemy Champion */}
                                        <Show
                                            when={duel.oppKey}
                                            fallback={
                                                <span class="text-xs text-neutral-600 font-title italic">
                                                    Empty
                                                </span>
                                            }
                                        >
                                            <div
                                                onClick={() =>
                                                    props.onClickChampion?.(
                                                        "opponent",
                                                        duel.oppKey!,
                                                    )
                                                }
                                                class="cursor-pointer hover:opacity-80 transition"
                                            >
                                                <ChampionCell
                                                    championKey={duel.oppKey!}
                                                    nameMaxLength={10}
                                                />
                                            </div>
                                        </Show>
                                    </div>

                                    {/* Matchup Stats */}
                                    <div class="text-right flex items-center gap-2">
                                        <Show when={duel.hasBoth}>
                                            <span
                                                class={cn(
                                                    "text-xs font-title font-bold font-mono px-2 py-0.5 rounded",
                                                    allyAdv
                                                        ? "text-ally bg-ally/10 border border-ally/30"
                                                        : "text-opponent bg-opponent/10 border border-opponent/30",
                                                )}
                                            >
                                                {allyAdv ? "+" : ""}
                                                {duel.deltaPct.toFixed(1)}%
                                            </span>
                                        </Show>
                                    </div>
                                </div>

                                {/* Tug-of-war balance bar */}
                                <Show when={duel.hasBoth}>
                                    <div class="relative h-1.5 bg-neutral-900 rounded-full overflow-hidden flex">
                                        <div
                                            class="h-full bg-ally/80 transition-all duration-300"
                                            style={{
                                                width: `${barSplit}%`,
                                            }}
                                        />
                                        <div
                                            class="h-full bg-opponent/80 transition-all duration-300"
                                            style={{
                                                width: `${100 - barSplit}%`,
                                            }}
                                        />
                                    </div>
                                </Show>
                            </div>
                        );
                    }}
                </For>
            </div>

            {/* Top Duo Synergies */}
            <Show when={topDuos().length > 0}>
                <div class="mt-4 pt-4 border-t border-neutral-800/80">
                    <h4 class="text-[11px] font-title font-bold uppercase tracking-wider text-neutral-400 mb-2">
                        Key Team Duo Synergies
                    </h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <For each={topDuos()}>
                            {(duo) => {
                                const duoAdv = duo.rating >= 0;
                                const duoWinrate =
                                    ratingToWinrate(duo.rating) * 100;
                                const duoDelta = duoWinrate - 50;

                                return (
                                    <div class="p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800/50 flex items-center justify-between gap-2">
                                        <div class="flex items-center gap-2">
                                            <RoleCell role={duo.roleA} />
                                            <ChampionCell
                                                championKey={duo.championKeyA}
                                                nameMaxLength={8}
                                            />
                                            <span class="text-neutral-600 text-xs font-bold">
                                                +
                                            </span>
                                            <RoleCell role={duo.roleB} />
                                            <ChampionCell
                                                championKey={duo.championKeyB}
                                                nameMaxLength={8}
                                            />
                                        </div>
                                        <span
                                            class={cn(
                                                "text-xs font-mono font-bold px-1.5 py-0.5 rounded",
                                                duoAdv
                                                    ? "text-winrate-good bg-emerald-950/40"
                                                    : "text-winrate-meh bg-rose-950/40",
                                            )}
                                        >
                                            {duoAdv ? "+" : ""}
                                            {duoDelta.toFixed(1)}%
                                        </span>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </div>
            </Show>
        </div>
    );
};
