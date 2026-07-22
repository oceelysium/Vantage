import { useDraft } from "../../contexts/DraftContext";
import { Role, displayNameByRole } from "@draftgap/core/src/models/Role";
import { Suggestion } from "@draftgap/core/src/draft/suggestions";
import { ChampionIcon } from "../icons/ChampionIcon";
import { RoleIcon } from "../icons/roles/RoleIcon";
import { batch, createSignal, onCleanup, onMount, Show, For } from "solid-js";
import { Icon } from "solid-heroicons";
import { star } from "solid-heroicons/solid";
import { star as starOutline } from "solid-heroicons/outline";
import { RatingText } from "../common/RatingText";
import { createMustSelectToast } from "../../utils/toast";
import { useUser } from "../../contexts/UserContext";
import { useDraftSuggestions } from "../../contexts/DraftSuggestionsContext";
import { useDataset } from "../../contexts/DatasetContext";
import { useDraftFilters } from "../../contexts/DraftFiltersContext";
import { informationCircle } from "solid-heroicons/solid-mini";
import { Dialog } from "../common/Dialog";
import { ChampionDraftAnalysisDialog } from "../dialogs/ChampionDraftAnalysisDialog";
import { Team } from "@draftgap/core/src/models/Team";
import { championName } from "../../utils/i18n";
import { getRatingClass } from "../../utils/rating";
import { ratingToWinrate } from "@draftgap/core/src/rating/ratings";
import { tooltip } from "../../directives/tooltip";

// eslint-disable-next-line
tooltip;

export default function DraftTable() {
    const { dataset, isLoaded } = useDataset();
    const {
        selection,
        pickChampion,
        select,
        bans,
        ownedChampions,
        allyTeam,
        opponentTeam,
    } = useDraft();
    const {
        search,
        roleFilter,
        setRoleFilter,
        favouriteFilter,
        setFavouriteFilter,
        layout,
        activeIndex,
    } = useDraftFilters();
    const { filteredSuggestions } = useDraftSuggestions();
    const { isFavourite, setFavourite, config } = useUser();

    const ownsChampion = (championKey: string) =>
        ownedChampions().size === 0 || ownedChampions().has(championKey);

    const [analysisPick, _setAnalysisPick] = createSignal<{
        team: Team;
        championKey: string;
    }>();
    const [showAnalysisPick, setShowAnalysisPick] = createSignal(false);
    const [savedRoleFilter, setSavedRoleFilter] = createSignal<Role>();

    function setAnalysisPick(
        pick:
            | { team: Team; championKey: string; role: Role | undefined }
            | undefined,
    ) {
        batch(() => {
            if (!pick) {
                pickChampion(
                    selection.team!,
                    selection.index,
                    undefined,
                    undefined,
                    {
                        updateSelection: false,
                        resetFilters: false,
                        reportEvent: false,
                        updateView: false,
                    },
                );
                setRoleFilter(savedRoleFilter());
                setSavedRoleFilter(undefined);
                setShowAnalysisPick(false);
                return;
            }
            if (pick.role !== undefined) {
                setSavedRoleFilter(roleFilter());
                pickChampion(
                    selection.team!,
                    selection.index,
                    pick.championKey,
                    pick.role,
                    {
                        updateSelection: false,
                        resetFilters: false,
                        reportEvent: false,
                        updateView: false,
                    },
                );
            }
            _setAnalysisPick(pick);
            setShowAnalysisPick(true);
        });
    }

    let lastPickAt = 0;

    function pick(suggestion: Suggestion) {
        if (!isLoaded()) return;

        const now = Date.now();
        if (now - lastPickAt < 350) return;
        lastPickAt = now;

        if (!selection.team) {
            createMustSelectToast();
            return;
        }

        const teamPicks =
            selection.team === "ally" ? allyTeam : opponentTeam;

        if (
            teamPicks.some((p) => p.championKey === suggestion.championKey)
        ) {
            return;
        }

        const firstEmpty = teamPicks.findIndex(
            (p) => p.championKey === undefined,
        );
        const index = firstEmpty !== -1 ? firstEmpty : selection.index;

        pickChampion(
            selection.team,
            index,
            suggestion.championKey,
            suggestion.role,
        );

        document.getElementById("draftTableSearch")?.focus();
    }

    const formatPercent = (val: number) => {
        const wr = ratingToWinrate(val);
        return `${(wr * 100).toFixed(1)}%`;
    };

    return (
        <div class="flex-1 flex flex-col min-h-0 overflow-y-auto px-1">
                <Show
                    when={layout() === "list"}
                    fallback={
                        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-8">
                            <For each={filteredSuggestions()}>
                                {(suggestion, index) => {
                                    const championData = () => dataset()!.championData[suggestion.championKey];
                                    const isBanned = () => bans.includes(suggestion.championKey);
                                    const isUnowned = () => !ownsChampion(suggestion.championKey);
                                    const fav = () => isFavourite(suggestion.championKey, suggestion.role);

                                    return (
                                        <div
                                            onClick={() => pick(suggestion)}
                                            id={"suggestion-row-" + index()}
                                            class="relative bg-neutral-900 border hover:border-secondary hover:shadow-[0_0_12px_rgba(0,243,255,0.12)] p-3 rounded-lg flex flex-col justify-between items-center transition-all duration-200 cursor-pointer group"
                                            classList={{
                                                "border-neutral-800": !fav(),
                                                "border-yellow-500/40 bg-yellow-500/[0.02]": fav(),
                                                "opacity-45 hover:opacity-100": isBanned() || isUnowned(),
                                                "border-secondary bg-neutral-800/40 shadow-[0_0_12px_rgba(0,243,255,0.12)]": activeIndex() === index(),
                                            }}
                                        >
                                            {/* Action Buttons Overlay */}
                                            <div class="absolute top-2 left-2 right-2 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                                                {/* Favorite Toggle */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFavourite(suggestion.championKey, suggestion.role, !fav());
                                                    }}
                                                    class="p-1 rounded bg-neutral-950/80 hover:bg-neutral-950 text-yellow-500 border border-neutral-800 transition"
                                                >
                                                    <Icon path={fav() ? star : starOutline} class="w-3.5 h-3.5" />
                                                </button>

                                                {/* Details Info Trigger */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAnalysisPick({
                                                            team: selection.team!,
                                                            championKey: suggestion.championKey,
                                                            role: suggestion.role,
                                                        });
                                                    }}
                                                    class="p-1 rounded bg-neutral-950/80 hover:bg-neutral-950 text-neutral-400 hover:text-secondary border border-neutral-800 transition"
                                                >
                                                    <Icon path={informationCircle} class="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            <div class="relative w-12 h-12 rounded-full overflow-hidden border-2 mb-2 transition-transform duration-200 group-hover:scale-105"
                                                classList={{
                                                    "border-red-800": getRatingClass(suggestion.draftResult.totalRating) === "text-winrate-shiggo",
                                                    "border-pink-300": getRatingClass(suggestion.draftResult.totalRating) === "text-winrate-meh",
                                                    "border-neutral-500": getRatingClass(suggestion.draftResult.totalRating) === "text-winrate-okay",
                                                    "border-green-500": getRatingClass(suggestion.draftResult.totalRating) === "text-winrate-good",
                                                    "border-secondary": getRatingClass(suggestion.draftResult.totalRating) === "text-winrate-great",
                                                    "border-yellow-500": getRatingClass(suggestion.draftResult.totalRating) === "text-winrate-volxd",
                                                }}
                                            >
                                                <ChampionIcon championKey={suggestion.championKey} size={48} />
                                            </div>

                                            {/* Name and Role */}
                                            <div class="text-center w-full">
                                                <div class="font-title text-xs font-bold text-neutral-100 truncate tracking-wide px-1">
                                                    {championName(championData(), config)}
                                                </div>
                                                <div class="flex items-center justify-center gap-1 mt-1">
                                                    <RoleIcon role={suggestion.role} class="w-3.5 h-3.5 text-neutral-400" />
                                                    <span class="text-[9px] font-mono text-neutral-500 uppercase">
                                                        {displayNameByRole[suggestion.role]}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Stats telemetry */}
                                            <div class="w-full mt-3 pt-2 border-t border-neutral-800/80 flex flex-col items-center">
                                                {/* Winrate score */}
                                                <div class={`text-sm font-title font-bold ${getRatingClass(suggestion.draftResult.totalRating)}`}>
                                                    {formatPercent(suggestion.draftResult.totalRating)}
                                                </div>

                                                {/* Telemetry breakdowns */}
                                                {config.showAdvancedWinrates && (
                                                    <div class="grid grid-cols-3 gap-1 w-full text-[8px] font-mono text-neutral-500 text-center mt-1.5 px-0.5">
                                                        <div title="Base Rating">
                                                            <span class="block text-neutral-600">BASE</span>
                                                            <span>{formatPercent(suggestion.draftResult.allyChampionRating.totalRating)}</span>
                                                        </div>
                                                        <div title="Matchup Rating">
                                                            <span class="block text-neutral-600">MCHP</span>
                                                            <span>{formatPercent(suggestion.draftResult.matchupRating.totalRating)}</span>
                                                        </div>
                                                        <div title="Duo Synergy">
                                                            <span class="block text-neutral-600">DUO</span>
                                                            <span>{formatPercent(suggestion.draftResult.allyDuoRating.totalRating)}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action tags */}
                                            <div class="flex gap-1 mt-2 h-4">
                                                <Show when={suggestion.draftResult.matchupRating.totalRating > 0.05}>
                                                    <span class="text-[7px] font-mono bg-green-500/10 text-green-400 px-1 rounded uppercase tracking-wider">Counter</span>
                                                </Show>
                                                <Show when={suggestion.draftResult.allyDuoRating.totalRating > 0.05}>
                                                    <span class="text-[7px] font-mono bg-indigo-500/10 text-indigo-400 px-1 rounded uppercase tracking-wider">Synergy</span>
                                                </Show>
                                                <Show when={isBanned()}>
                                                    <span class="text-[7px] font-mono bg-red-500/15 text-red-400 px-1 rounded uppercase tracking-wider">Banned</span>
                                                </Show>
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    }
                >
                    {/* List layout: table-like list of rows */}
                    <div class="flex flex-col gap-1.5 pb-8 text-neutral-300 select-none">
                        {/* Table Header */}
                        <div class="flex items-center px-4 py-3 border-b border-neutral-800 text-[10px] uppercase font-title font-bold text-neutral-500 tracking-wider">
                            <div class="w-8 text-center">Fav</div>
                            <div class="w-12 text-center font-bold">Role</div>
                            <div class="flex-1 pl-4">Champion</div>
                            <Show when={config.showAdvancedWinrates}>
                                <div class="w-48 grid grid-cols-3 text-center hidden md:grid">
                                    <span>Base</span>
                                    <span>Matchup</span>
                                    <span>Synergy</span>
                                </div>
                            </Show>
                            <div class="w-32 text-center hidden sm:block">Status / Tags</div>
                            <div class="w-20 text-right pr-4">Winrate</div>
                            <div class="w-8"></div>
                        </div>

                        {/* Table Rows */}
                        <For each={filteredSuggestions()}>
                            {(suggestion, index) => {
                                const championData = () => dataset()!.championData[suggestion.championKey];
                                const isBanned = () => bans.includes(suggestion.championKey);
                                const isUnowned = () => !ownsChampion(suggestion.championKey);
                                const fav = () => isFavourite(suggestion.championKey, suggestion.role);

                                return (
                                    <div
                                        onClick={() => pick(suggestion)}
                                        id={"suggestion-row-" + index()}
                                        class="flex items-center px-4 py-3.5 bg-neutral-900/30 hover:bg-neutral-800/40 border border-neutral-800/80 hover:border-neutral-700/60 rounded-md transition-all duration-150 cursor-pointer group"
                                        classList={{
                                            "border-yellow-500/20 bg-yellow-500/[0.01]": fav(),
                                            "opacity-45 hover:opacity-100": isBanned() || isUnowned(),
                                            "border-secondary bg-neutral-800/60 shadow-[0_0_12px_rgba(0,243,255,0.08)]": activeIndex() === index(),
                                        }}
                                    >
                                        {/* Favorite Toggle */}
                                        <div class="w-8 flex justify-center items-center">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFavourite(suggestion.championKey, suggestion.role, !fav());
                                                }}
                                                class="text-neutral-600 hover:text-yellow-500 transition-colors"
                                                classList={{
                                                    "text-yellow-500": fav(),
                                                }}
                                            >
                                                <Icon path={fav() ? star : starOutline} class="w-4.5 h-4.5" />
                                            </button>
                                        </div>

                                        {/* Role Icon */}
                                        <div class="w-12 flex justify-center items-center">
                                            <div
                                                class="p-1.5 rounded bg-neutral-950/60"
                                                // @ts-ignore
                                                use:tooltip={{
                                                    content: <>{displayNameByRole[suggestion.role]} Position</>,
                                                }}
                                            >
                                                <RoleIcon role={suggestion.role} class="w-4.5 h-4.5 text-neutral-400" />
                                            </div>
                                        </div>

                                        {/* Champion Portrait & Name */}
                                        <div class="flex-1 flex items-center gap-3 pl-4 min-w-0">
                                            <div class="relative w-10 h-10 rounded-full overflow-hidden border transition-transform duration-200 group-hover:scale-105"
                                                classList={{
                                                    "border-red-800": getRatingClass(suggestion.draftResult.totalRating) === "text-winrate-shiggo",
                                                    "border-pink-300": getRatingClass(suggestion.draftResult.totalRating) === "text-winrate-meh",
                                                    "border-neutral-500": getRatingClass(suggestion.draftResult.totalRating) === "text-winrate-okay",
                                                    "border-green-500": getRatingClass(suggestion.draftResult.totalRating) === "text-winrate-good",
                                                    "border-secondary": getRatingClass(suggestion.draftResult.totalRating) === "text-winrate-great",
                                                    "border-yellow-500": getRatingClass(suggestion.draftResult.totalRating) === "text-winrate-volxd",
                                                }}
                                            >
                                                <ChampionIcon championKey={suggestion.championKey} size={40} />
                                            </div>
                                            <span class="font-title text-sm font-bold text-neutral-100 truncate">
                                                {championName(championData(), config)}
                                            </span>
                                        </div>

                                        {/* Advanced Breakdown */}
                                        <Show when={config.showAdvancedWinrates}>
                                            <div class="w-48 grid grid-cols-3 text-center text-xs font-mono text-neutral-400 hidden md:grid">
                                                <span>{formatPercent(suggestion.draftResult.allyChampionRating.totalRating)}</span>
                                                <span>{formatPercent(suggestion.draftResult.matchupRating.totalRating)}</span>
                                                <span>{formatPercent(suggestion.draftResult.allyDuoRating.totalRating)}</span>
                                            </div>
                                        </Show>

                                        {/* Action Tags / Badges */}
                                        <div class="w-32 flex justify-center gap-1.5 hidden sm:flex">
                                            <Show when={suggestion.draftResult.matchupRating.totalRating > 0.05}>
                                                <span class="text-[8px] font-mono bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Counter</span>
                                            </Show>
                                            <Show when={suggestion.draftResult.allyDuoRating.totalRating > 0.05}>
                                                <span class="text-[8px] font-mono bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Synergy</span>
                                            </Show>
                                            <Show when={isBanned()}>
                                                <span class="text-[8px] font-mono bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Banned</span>
                                            </Show>
                                        </div>

                                        {/* Winrate */}
                                        <div class="w-20 text-right pr-4">
                                            <span class={`font-title text-base font-bold ${getRatingClass(suggestion.draftResult.totalRating)}`}>
                                                {formatPercent(suggestion.draftResult.totalRating)}
                                            </span>
                                        </div>

                                        {/* Details Info Trigger */}
                                        <div class="w-8 flex justify-center items-center">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setAnalysisPick({
                                                        team: selection.team!,
                                                        championKey: suggestion.championKey,
                                                        role: suggestion.role,
                                                    });
                                                }}
                                                class="p-1 rounded bg-neutral-950/80 hover:bg-neutral-950 text-neutral-500 hover:text-secondary border border-neutral-800 transition"
                                            >
                                                <Icon path={informationCircle} class="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </Show>

            <Dialog
                open={showAnalysisPick()}
                onOpenChange={(open) => {
                    if (!open) setAnalysisPick(undefined);
                }}
            >
                <ChampionDraftAnalysisDialog
                    championKey={analysisPick()!.championKey}
                    team={analysisPick()!.team}
                    openChampionDraftAnalysisModal={(team, championKey) =>
                        setAnalysisPick({ team, championKey, role: undefined })
                    }
                />
            </Dialog>
        </div>
    );
}
