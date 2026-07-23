import { Component, Show } from "solid-js";
import { Team } from "@draftgap/core/src/models/Team";
import { useDraftAnalysis } from "../../../contexts/DraftAnalysisContext";
import { useUser } from "../../../contexts/UserContext";
import { ratingToWinrate } from "@draftgap/core/src/rating/ratings";
import { RatingText } from "../../common/RatingText";
import { cn } from "../../../utils/style";

interface Props {
    team: Team;
    class?: string;
}

export const WinrateWaterfallCard: Component<Props> = (props) => {
    const { config } = useUser();
    const { allyDraftAnalysis, opponentDraftAnalysis } = useDraftAnalysis();

    const draftResult = () =>
        props.team === "ally" ? allyDraftAnalysis() : opponentDraftAnalysis();

    const isAlly = () => props.team === "ally";

    // Winrates & deltas
    const winratePct = () => (draftResult()?.winrate ?? 0.5) * 100;
    const stdErrorPct = () => (draftResult()?.winrateStdError ?? 0) * 100;

    const baseRating = () =>
        config.ignoreChampionWinrates
            ? 0
            : draftResult()?.allyChampionRating?.totalRating ?? 0;
    const duoRating = () => draftResult()?.allyDuoRating?.totalRating ?? 0;
    const matchupRating = () => draftResult()?.matchupRating?.totalRating ?? 0;

    const baseDeltaPct = () =>
        config.ignoreChampionWinrates
            ? 0
            : (ratingToWinrate(baseRating()) - 0.5) * 100;
    const duoDeltaPct = () => (ratingToWinrate(duoRating()) - 0.5) * 100;
    const matchupDeltaPct = () => (ratingToWinrate(matchupRating()) - 0.5) * 100;

    const formatDelta = (val: number) => {
        const sign = val > 0 ? "+" : "";
        return `${sign}${val.toFixed(1)}%`;
    };

    return (
        <div
            class={cn(
                "p-5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 shadow-md relative overflow-hidden",
                props.class,
            )}
        >
            {/* Header */}
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="text-xs font-title font-bold uppercase tracking-wider text-neutral-400">
                        Win-Probability Waterfall
                    </h3>
                    <p class="text-[11px] text-neutral-500 font-body mt-0.5">
                        Additive winrate buildup starting from 50.0% baseline
                    </p>
                </div>
                <div class="text-right">
                    <span class="text-xs text-neutral-500 font-mono block">
                        ESTIMATED WINRATE
                    </span>
                    <span
                        class={cn(
                            "text-2xl font-title font-bold tracking-tight",
                            isAlly() ? "text-ally" : "text-opponent",
                        )}
                    >
                        {winratePct().toFixed(1)}%
                    </span>
                    <Show when={stdErrorPct() > 0}>
                        <span class="text-[10px] text-neutral-500 font-mono block">
                            ± {stdErrorPct().toFixed(1)}% confidence
                        </span>
                    </Show>
                </div>
            </div>

            {/* Waterfall Bridge Steps */}
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
                {/* 1. Baseline */}
                <div class="px-2.5 py-3 rounded-lg bg-neutral-950/60 border border-neutral-800/60 flex flex-col justify-between overflow-hidden">
                    <div class="h-8 flex items-start justify-between shrink-0">
                        <span class="text-[10px] text-neutral-400 font-title uppercase tracking-wider leading-tight">
                            Baseline
                        </span>
                    </div>
                    <div class="pt-1 flex flex-col">
                        <span class="text-base font-title font-bold text-neutral-300 leading-none truncate">
                            50.0%
                        </span>
                        <span class="text-[10px] text-neutral-500 font-mono mt-1.5 truncate">
                            start
                        </span>
                    </div>
                </div>

                {/* 2. Base Champions */}
                <div
                    class={cn(
                        "px-2.5 py-3 rounded-lg bg-neutral-950/60 border flex flex-col justify-between transition-all overflow-hidden",
                        config.ignoreChampionWinrates
                            ? "border-neutral-800/40 opacity-50"
                            : baseDeltaPct() > 0
                            ? "border-emerald-500/30 bg-emerald-950/10"
                            : baseDeltaPct() < 0
                            ? "border-rose-500/30 bg-rose-950/10"
                            : "border-neutral-800/60",
                    )}
                >
                    <div class="h-8 flex items-start justify-between shrink-0 gap-1">
                        <span class="text-[10px] text-neutral-400 font-title uppercase tracking-wider leading-tight">
                            Base Champs
                        </span>
                        <Show when={config.ignoreChampionWinrates}>
                            <span class="text-[9px] text-amber-400 bg-amber-500/10 px-1 rounded uppercase shrink-0">
                                Ignored
                            </span>
                        </Show>
                    </div>
                    <div class="pt-1 flex flex-col">
                        <span
                            class={cn(
                                "text-base font-title font-bold leading-none truncate",
                                baseDeltaPct() > 0
                                    ? "text-winrate-good"
                                    : baseDeltaPct() < 0
                                    ? "text-winrate-meh"
                                    : "text-neutral-400",
                            )}
                        >
                            {formatDelta(baseDeltaPct())}
                        </span>
                        <span class="text-[10px] text-neutral-500 font-mono mt-1.5 truncate">
                            <RatingText rating={baseRating()} />
                        </span>
                    </div>
                </div>

                {/* 3. Synergies (Duos) */}
                <div
                    class={cn(
                        "px-2.5 py-3 rounded-lg bg-neutral-950/60 border flex flex-col justify-between transition-all overflow-hidden",
                        duoDeltaPct() > 0
                            ? "border-emerald-500/30 bg-emerald-950/10"
                            : duoDeltaPct() < 0
                            ? "border-rose-500/30 bg-rose-950/10"
                            : "border-neutral-800/60",
                    )}
                >
                    <div class="h-8 flex items-start justify-between shrink-0">
                        <span class="text-[10px] text-neutral-400 font-title uppercase tracking-wider leading-tight">
                            Synergies
                        </span>
                    </div>
                    <div class="pt-1 flex flex-col">
                        <span
                            class={cn(
                                "text-base font-title font-bold leading-none truncate",
                                duoDeltaPct() > 0
                                    ? "text-winrate-good"
                                    : duoDeltaPct() < 0
                                    ? "text-winrate-meh"
                                    : "text-neutral-400",
                            )}
                        >
                            {formatDelta(duoDeltaPct())}
                        </span>
                        <span class="text-[10px] text-neutral-500 font-mono mt-1.5 truncate">
                            <RatingText rating={duoRating()} />
                        </span>
                    </div>
                </div>

                {/* 4. Matchups */}
                <div
                    class={cn(
                        "px-2.5 py-3 rounded-lg bg-neutral-950/60 border flex flex-col justify-between transition-all overflow-hidden",
                        matchupDeltaPct() > 0
                            ? "border-emerald-500/30 bg-emerald-950/10"
                            : matchupDeltaPct() < 0
                            ? "border-rose-500/30 bg-rose-950/10"
                            : "border-neutral-800/60",
                    )}
                >
                    <div class="h-8 flex items-start justify-between shrink-0">
                        <span class="text-[10px] text-neutral-400 font-title uppercase tracking-wider leading-tight">
                            Matchups
                        </span>
                    </div>
                    <div class="pt-1 flex flex-col">
                        <span
                            class={cn(
                                "text-base font-title font-bold leading-none truncate",
                                matchupDeltaPct() > 0
                                    ? "text-winrate-good"
                                    : matchupDeltaPct() < 0
                                    ? "text-winrate-meh"
                                    : "text-neutral-400",
                            )}
                        >
                            {formatDelta(matchupDeltaPct())}
                        </span>
                        <span class="text-[10px] text-neutral-500 font-mono mt-1.5 truncate">
                            <RatingText rating={matchupRating()} />
                        </span>
                    </div>
                </div>

                {/* 5. Total Result */}
                <div
                    class={cn(
                        "px-2.5 py-3 rounded-lg border flex flex-col justify-between col-span-2 sm:col-span-1 overflow-hidden",
                        isAlly()
                            ? "bg-ally/10 border-ally/40 text-ally"
                            : "bg-opponent/10 border-opponent/40 text-opponent",
                    )}
                >
                    <div class="h-8 flex items-start justify-between shrink-0">
                        <span class="text-[10px] font-title font-bold uppercase tracking-wider leading-tight">
                            Final Total
                        </span>
                    </div>
                    <div class="pt-1 flex flex-col">
                        <span class="text-base font-title font-bold leading-none truncate">
                            {winratePct().toFixed(1)}%
                        </span>
                        <span class="text-[10px] font-mono opacity-80 mt-1.5 truncate">
                            {formatDelta(winratePct() - 50)} net
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
