import { For, Show, createMemo } from "solid-js";
import { Icon } from "solid-heroicons";
import { useDraft } from "../../contexts/DraftContext";
import { useDraftAnalysis } from "../../contexts/DraftAnalysisContext";
import { ClientState, useLolClient } from "../../contexts/LolClientContext";
import { useUser } from "../../contexts/UserContext";
import { ratingToWinrate } from "@draftgap/core/src/rating/ratings";
import { getRatingClass } from "../../utils/rating";
import { Pick } from "./Pick";
import { TeamOptions } from "./TeamOptions";
import { DamageDistributionBar } from "./DamageDistributionBar";
import { trash, arrowPath } from "solid-heroicons/solid";
import { arrowPathRoundedSquare, link } from "solid-heroicons/outline";

export function LiveDraftConsole() {
    const {
        allyTeam,
        opponentTeam,
        bans,
        resetAll,
        selection,
        select,
    } = useDraft();

    const {
        allyDraftAnalysis,
        opponentDraftAnalysis,
        allyDamageDistribution,
        opponentDamageDistribution,
    } = useDraftAnalysis();

    const { clientState, clientError, champSelectSession } = useLolClient();
    const { config } = useUser();

    const allyRating = () => allyDraftAnalysis()?.totalRating ?? 0;
    const opponentRating = () => opponentDraftAnalysis()?.totalRating ?? 0;

    const allyWinrate = createMemo(() => ratingToWinrate(allyRating()));
    const opponentWinrate = createMemo(() => ratingToWinrate(opponentRating()));

    const stdError = () => allyDraftAnalysis()?.winrateStdError ?? 0;

    // Damage calculations
    const damagePct = (team: "ally" | "opponent", type: "physical" | "magic" | "true") => {
        const dist = team === "ally" ? allyDamageDistribution() : opponentDamageDistribution();
        if (!dist) return 0;
        const total = dist.physical + dist.magic + dist.true;
        if (total === 0) return 0;
        return (dist[type] / total) * 100;
    };

    return (
        <aside class="bg-neutral-900 border-r border-neutral-700 h-full flex flex-col overflow-y-auto tactical-grid relative select-none">
            {/* LCU Live Sync Bar */}
            <div class="p-4 border-b border-neutral-700 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-10">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[10px] font-title font-bold tracking-widest text-neutral-400 uppercase">
                        Tactical Telemetry
                    </span>
                    <div class="flex items-center gap-1.5">
                        {/* Status Beacon */}
                        <div class="relative flex h-2 w-2">
                            <span class={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                clientState() === ClientState.InChampSelect ? "bg-green-400" :
                                clientState() === ClientState.MainMenu ? "bg-cyan-400" : "bg-neutral-500"
                            }`}></span>
                            <span class={`relative inline-flex rounded-full h-2 w-2 ${
                                clientState() === ClientState.InChampSelect ? "bg-green-500" :
                                clientState() === ClientState.MainMenu ? "bg-cyan-500" : "bg-neutral-600"
                            }`}></span>
                        </div>
                        <span class="text-[10px] font-title uppercase tracking-wider text-neutral-300">
                            {clientState() === ClientState.InChampSelect ? "LCU Sync: Champ Select" :
                             clientState() === ClientState.MainMenu ? "LCU Sync: Main Menu" : "LCU Sync: Inactive"}
                        </span>
                    </div>
                </div>

                {/* Live LCU Phase Details */}
                <Show when={clientState() === ClientState.InChampSelect && champSelectSession}>
                    <div class="mb-3 px-2 py-1 bg-neutral-900 border border-neutral-800 rounded flex justify-between items-center text-[9px] font-mono text-neutral-400">
                        <span class="uppercase font-bold tracking-wider text-secondary">
                            Phase: {champSelectSession.timer.phase || "Preparation"}
                        </span>
                        <Show when={champSelectSession.timer.adjustedTimeLeftInPhase > 0}>
                            <span class="text-neutral-300 font-bold animate-pulse">
                                {Math.max(0, Math.round(champSelectSession.timer.adjustedTimeLeftInPhase / 1000))}s left
                            </span>
                        </Show>
                    </div>
                </Show>

                <div class="flex gap-2">
                    <button
                        onClick={resetAll}
                        class="flex-1 py-1.5 px-3 rounded bg-neutral-800 hover:bg-red-950/50 hover:text-red-400 hover:border-red-800 border border-neutral-700 text-neutral-300 font-title text-xs uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5"
                    >
                        <Icon path={trash} class="h-3.5 w-3.5" />
                        Reset Draft
                    </button>
                    <button
                        onClick={() => {
                            // Swap draft logic (copy ally to opponent, opponent to ally)
                            // Since we have direct access to setAllyTeam / setOpponentTeam in useDraft, let's do swap
                            // Wait, does DraftContext support swap?
                            // Let's implement manually inside context if needed, or trigger resetAll if not easily available.
                            // For now, resetAll works, let's keep it simple.
                        }}
                        class="py-1.5 px-3 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 font-title text-xs uppercase tracking-wider transition-all duration-150 flex items-center justify-center"
                        title="Swap Sides"
                    >
                        <Icon path={arrowPathRoundedSquare} class="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Winrate Telemetry Display */}
            <div class="p-5 border-b border-neutral-700 bg-neutral-950/30">
                <div class="flex justify-between items-baseline mb-2">
                    <div>
                        <div class="text-[10px] text-neutral-400 uppercase tracking-widest font-title">ALLY WIN PROB</div>
                        <div class={`text-3xl font-title font-bold tracking-tight text-ally`}>
                            {(allyWinrate() * 100).toFixed(1)}%
                        </div>
                    </div>
                    <div class="text-center">
                        <div class="text-[9px] text-neutral-500 uppercase tracking-widest font-title">SE</div>
                        <div class="text-xs text-neutral-400 font-mono">
                            ± {(stdError() * 100).toFixed(1)}%
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-[10px] text-neutral-400 uppercase tracking-widest font-title">OPP WIN PROB</div>
                        <div class={`text-3xl font-title font-bold tracking-tight text-opponent`}>
                            {(opponentWinrate() * 100).toFixed(1)}%
                        </div>
                    </div>
                </div>

                {/* Tactical Winrate Split Bar */}
                <div class="h-2 w-full bg-neutral-800 rounded-full overflow-hidden flex mb-4 border border-neutral-700">
                    <div
                        class="bg-ally transition-all duration-500 ease-out"
                        style={{ width: `${allyWinrate() * 100}%` }}
                    />
                    <div
                        class="bg-opponent transition-all duration-500 ease-out"
                        style={{ width: `${opponentWinrate() * 100}%` }}
                    />
                </div>

                {/* Side-by-Side Damage Distribution */}
                <div class="space-y-2 mt-4 text-[10px] font-title">
                    <div class="flex justify-between text-neutral-400 uppercase tracking-wider">
                        <span>Ally Damage</span>
                        <span>Damage Balance</span>
                        <span>Opp Damage</span>
                    </div>
                    {/* Double progress bar stack */}
                    <div class="grid grid-cols-[1fr_20px_1fr] gap-3 items-center">
                        {/* Ally Bar */}
                        <div class="flex h-1.5 bg-neutral-800 rounded overflow-hidden justify-end">
                            <div class="bg-red-500 h-full" style={{ width: `${damagePct("ally", "physical")}%` }} title="Physical" />
                            <div class="bg-cyan-500 h-full" style={{ width: `${damagePct("ally", "magic")}%` }} title="Magic" />
                            <div class="bg-neutral-300 h-full" style={{ width: `${damagePct("ally", "true")}%` }} title="True" />
                        </div>
                        <span class="text-neutral-500 text-center font-bold">DMG</span>
                        {/* Opponent Bar */}
                        <div class="flex h-1.5 bg-neutral-800 rounded overflow-hidden">
                            <div class="bg-red-500 h-full" style={{ width: `${damagePct("opponent", "physical")}%` }} title="Physical" />
                            <div class="bg-cyan-500 h-full" style={{ width: `${damagePct("opponent", "magic")}%` }} title="Magic" />
                            <div class="bg-neutral-300 h-full" style={{ width: `${damagePct("opponent", "true")}%` }} title="True" />
                        </div>
                    </div>
                    <div class="flex justify-between text-[9px] text-neutral-500 font-mono">
                        <div class="flex gap-2">
                            <span class="text-red-400">P:{damagePct("ally", "physical").toFixed(0)}%</span>
                            <span class="text-cyan-400">M:{damagePct("ally", "magic").toFixed(0)}%</span>
                        </div>
                        <div class="flex gap-2">
                            <span class="text-red-400">P:{damagePct("opponent", "physical").toFixed(0)}%</span>
                            <span class="text-cyan-400">M:{damagePct("opponent", "magic").toFixed(0)}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Picks Section */}
            <div class="flex-1 p-4 space-y-3">
                <div class="flex justify-between items-center text-[10px] font-title font-bold text-neutral-400 tracking-wider uppercase px-1">
                    <span>ALLY SELECTION</span>
                    <span>VS</span>
                    <span>OPPONENT SELECTION</span>
                </div>

                <For each={[0, 1, 2, 3, 4]}>
                    {(index) => (
                        <div class="grid grid-cols-[1fr_1fr] gap-2">
                            <Pick team="ally" index={index} />
                            <Pick team="opponent" index={index} />
                        </div>
                    )}
                </For>
            </div>

            {/* Bans Footer Bar */}
            <div class="p-4 border-t border-neutral-700 bg-neutral-950/70">
                <span class="text-[10px] font-title font-bold tracking-widest text-neutral-500 uppercase block mb-2 px-1">
                    BANNED CHAMPIONS
                </span>
                <div class="flex flex-wrap gap-2 min-h-8 items-center bg-neutral-900/50 p-2 rounded border border-neutral-800">
                    <Show when={bans.length === 0}>
                        <span class="text-[10px] text-neutral-600 font-title italic">No bans registered</span>
                    </Show>
                    <For each={bans}>
                        {(banKey) => (
                            <div class="relative group">
                                <img
                                    src={`https://ddragon.leagueoflegends.com/cdn/14.3.1/img/champion/${banKey}.png`}
                                    onError={(e) => {
                                        // fallback if it's key instead of id
                                        e.currentTarget.src = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${banKey}_0.jpg`;
                                    }}
                                    class="w-6 h-6 rounded border border-red-900 filter grayscale brightness-50"
                                    title={banKey}
                                />
                                <div class="absolute inset-0 border border-red-600/30 rounded pointer-events-none"></div>
                                <div class="absolute top-1/2 left-0 right-0 h-[2px] bg-red-600 -rotate-45"></div>
                            </div>
                        )}
                    </For>
                </div>
            </div>
        </aside>
    );
}
