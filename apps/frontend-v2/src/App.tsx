import { Icon } from "solid-heroicons";
import {
    Component,
    createMemo,
    createSignal,
    For,
    Match,
    Show,
    Switch,
} from "solid-js";
import DraftTable from "./components/draft/DraftTable";
import { RoleFilter } from "./components/draft/RoleFilter";
import { Search } from "./components/draft/Search";
import { TeamSelector } from "./components/draft/TeamSelector";
import { TeamSidebar } from "./components/draft/TeamSidebar";
import { cog_6Tooth } from "solid-heroicons/solid";
import AnalysisView from "./components/views/analysis/AnalysisView";
import { Badge } from "./components/common/Badge";
import { FilterMenu } from "./components/draft/FilterMenu";
import { formatDistance } from "date-fns";
import { ViewTabs } from "./components/common/ViewTabs";
import { BuildsView } from "./components/views/builds/BuildsView";
import { useDraftView } from "./contexts/DraftViewContext";
import { useDraft } from "./contexts/DraftContext";
import { useDraftFilters } from "./contexts/DraftFiltersContext";
import { arrowPath, listBullet, squares_2x2 } from "solid-heroicons/outline";
import { tooltip } from "./directives/tooltip";
// eslint-disable-next-line
tooltip;
import { useUser } from "./contexts/UserContext";
import { displayNameByTier, DEFAULT_TIER } from "@draftgap/core/src/models/Tier";
import { useDataset } from "./contexts/DatasetContext";
import type { Dataset } from "@draftgap/core/src/models/dataset/Dataset";
import { LoadingIcon } from "./components/icons/LoadingIcon";
import { DialogTrigger, Dialog } from "./components/common/Dialog";
import SettingsDialog from "./components/dialogs/SettingsDialog";
import { FAQDialog } from "./components/dialogs/FAQDialog";
import { DesktopAppDialog } from "./components/dialogs/DesktopAppDialog";
import { UpdateDialog } from "./components/dialogs/UpdateDialog";
import { OptionsDropdownMenu } from "./components/OptionsMenu";
import { useDraftAnalysis } from "./contexts/DraftAnalysisContext";
import { ChampionDraftAnalysisDialog } from "./components/dialogs/ChampionDraftAnalysisDialog";
import { AnalyzeHoverToggle } from "./components/draft/AnalyzeHoverToggle";
import { useMedia } from "./hooks/useMedia";
import { buttonVariants } from "./components/common/Button";
import { cn } from "./utils/style";
import { LanguageDropdownMenu } from "./components/LanguageMenu";

function patchSummary(patches: string[]) {
    if (!patches.length) return "—";
    if (patches.length === 1) return `patch ${patches[0]}`;
    return `patches ${patches[0]}–${patches[patches.length - 1]}`;
}

function leagueSummary(leagues: string[]) {
    if (!leagues.length) return "all leagues";
    if (leagues.length <= 3) return leagues.join(", ");
    return `${leagues.slice(0, 2).join(", ")} +${leagues.length - 2}`;
}

// Sum of base games across all champion-roles. There are ~10 champion-role rows
// per game (5 picks per side), so dividing by 10 approximates distinct games.
function datasetGames(ds: Dataset) {
    let total = 0;
    for (const champion of Object.values(ds.championData)) {
        for (const role of Object.values(champion.statsByRole)) {
            total += role.games;
        }
    }
    return total / 10;
}

function formatCount(n: number) {
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return `${Math.round(n)}`;
}

const App: Component = () => {
    const { config } = useUser();
    const { currentDraftView, setCurrentDraftView } = useDraftView();
    const { dataset, dataset30Days, isLoaded } = useDataset();
    const isPro = () => (config.dataSource ?? "soloq") === "pro";

    // Current-patch sample size, and how it compares to the 30-day window
    // (a self-calibrating "how thin is this patch" signal).
    const currentGames = createMemo(() => {
        const ds = dataset();
        return ds ? datasetGames(ds) : 0;
    });
    const patchVolumePct = createMemo(() => {
        const full = dataset30Days();
        if (!full) return undefined;
        const fullGames = datasetGames(full);
        return fullGames > 0
            ? Math.round((currentGames() / fullGames) * 100)
            : undefined;
    });
    const { analysisPick, setAnalysisPick, showAnalysisPick } =
        useDraftAnalysis();
    const { isDesktop } = useMedia();
    const { resetAll } = useDraft();
    const { layout, setLayout } = useDraftFilters();

    const [showSettings, setShowSettings] = createSignal(false);
    const [showFAQ, setShowFAQ] = createSignal(false);
    const [showDownloadModal, setShowDownloadModal] = createSignal(false);

    const timeAgo = () =>
        dataset()
            ? formatDistance(new Date(dataset()!.date), new Date(), {
                  addSuffix: true,
              })
            : "";

    const MainView = () => {
        return (
            <div
                class="bg-neutral-900 flex-1 overflow-auto overflow-x-hidden h-full flex flex-col"
                style={{
                    "scroll-behavior": "smooth",
                }}
            >
                <Switch>
                    <Match
                        when={
                            dataset.state === "ready" && dataset() === undefined
                        }
                    >
                        <Show
                            when={isPro()}
                            fallback={
                                <div class="flex justify-center items-center h-full text-2xl text-red-500">
                                    An unexpected error occurred. Please try
                                    again later.
                                </div>
                            }
                        >
                            <div class="flex flex-col justify-center items-center h-full gap-3 text-center px-8">
                                <span class="text-2xl text-yellow-500">
                                    No pro dataset found
                                </span>
                                <span class="text-neutral-400 max-w-lg">
                                    Build it first, then reload: run{" "}
                                    <span class="font-mono text-neutral-200">
                                        bun run pro:local
                                        &lt;oracles-elixir.csv&gt;
                                    </span>{" "}
                                    in apps/dataset. Or switch Data source back
                                    to Soloqueue in Settings.
                                </span>
                            </div>
                        </Show>
                    </Match>
                    <Match when={!isLoaded()}>
                        <div class="flex justify-center items-center h-full text-2xl">
                            <LoadingIcon class="animate-spin h-10 w-10" />
                        </div>
                    </Match>
                    <Match when={isLoaded()}>
                        <Dialog
                            open={showAnalysisPick()}
                            onOpenChange={(open) => {
                                if (!open) setAnalysisPick(undefined);
                            }}
                        >
                            <ChampionDraftAnalysisDialog
                                championKey={analysisPick()!.championKey}
                                team={analysisPick()!.team}
                                openChampionDraftAnalysisModal={(
                                    team,
                                    championKey,
                                ) => setAnalysisPick({ team, championKey })}
                            />
                        </Dialog>
                        <div class="flex flex-col min-h-full flex-1">
                            <ViewTabs
                                tabs={
                                    [
                                        {
                                            label: "Draft",
                                            value: "draft",
                                        },
                                        {
                                            label: "Draft Analysis",
                                            value: "analysis",
                                        },
                                        ...(config.enableBetaFeatures
                                            ? ([
                                                  {
                                                      label: "Builds",
                                                      value: "builds",
                                                  },
                                              ] as const)
                                            : []),
                                    ] as const
                                }
                                selected={currentDraftView().type}
                                onChange={(type) =>
                                    setCurrentDraftView({
                                        type,
                                        subType: "draft",
                                    })
                                }
                                class="xl:px-8"
                            />
                            <Switch>
                                <Match
                                    when={currentDraftView().type == "draft"}
                                >
                                    <div class="py-5 px-4 xl:px-8 h-full overflow-y-hidden flex flex-col">
                                        <div class="mb-4 flex gap-4">
                                            <Search />
                                            <TeamSelector />
                                            <RoleFilter class="hidden lg:inline-flex" />
                                            <div class="hidden lg:inline-flex gap-3">
                                                <FilterMenu />
                                                <Show when={isDesktop}>
                                                    <AnalyzeHoverToggle />
                                                </Show>

                                                {/* Layout Toggle */}
                                                <div class="flex bg-neutral-950 border border-neutral-800 rounded p-0.5">
                                                    <button
                                                        onClick={() => setLayout("list")}
                                                        class={cn(
                                                            "p-1 rounded transition",
                                                            layout() === "list"
                                                                ? "bg-neutral-800 text-secondary"
                                                                : "text-neutral-500 hover:text-neutral-300"
                                                        )}
                                                        // @ts-ignore
                                                        use:tooltip={{ content: <>List View (Best for comparing winrates)</> }}
                                                    >
                                                        <Icon path={listBullet} class="h-4.5 w-4.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => setLayout("grid")}
                                                        class={cn(
                                                            "p-1 rounded transition",
                                                            layout() === "grid"
                                                                ? "bg-neutral-800 text-secondary"
                                                                : "text-neutral-500 hover:text-neutral-300"
                                                        )}
                                                        // @ts-ignore
                                                        use:tooltip={{ content: <>Grid View (Best for champion portraits)</> }}
                                                    >
                                                        <Icon path={squares_2x2} class="h-4.5 w-4.5" />
                                                    </button>
                                                </div>

                                                <button
                                                    onClick={() => resetAll()}
                                                    class={cn(
                                                        buttonVariants({ variant: "secondary" }),
                                                        "px-3 py-2 flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white border-neutral-700 hover:border-neutral-500 bg-neutral-900 rounded",
                                                    )}
                                                    // @ts-ignore
                                                    use:tooltip={{
                                                        content: <>Reset the entire board (picks, bans, and filters)</>,
                                                    }}
                                                >
                                                    <Icon path={arrowPath} class="h-4 w-4" />
                                                    <span>RESET BOARD</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div class="flex justify-end mb-4 gap-4 lg:hidden">
                                            <RoleFilter class="w-full" />
                                            <FilterMenu />
                                            <AnalyzeHoverToggle />

                                            {/* Mobile Layout Toggle */}
                                            <div class="flex bg-neutral-950 border border-neutral-800 rounded p-0.5">
                                                <button
                                                    onClick={() => setLayout("list")}
                                                    class={cn(
                                                        "p-1.5 rounded transition",
                                                        layout() === "list"
                                                            ? "bg-neutral-800 text-secondary"
                                                            : "text-neutral-500"
                                                    )}
                                                >
                                                    <Icon path={listBullet} class="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => setLayout("grid")}
                                                    class={cn(
                                                        "p-1.5 rounded transition",
                                                        layout() === "grid"
                                                            ? "bg-neutral-800 text-secondary"
                                                            : "text-neutral-500"
                                                    )}
                                                >
                                                    <Icon path={squares_2x2} class="h-4 w-4" />
                                                </button>
                                            </div>

                                            <button
                                                onClick={() => resetAll()}
                                                class={cn(
                                                    buttonVariants({ variant: "secondary" }),
                                                    "px-3 py-2 flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white border-neutral-700 hover:border-neutral-500 bg-neutral-900 rounded",
                                                )}
                                                // @ts-ignore
                                                use:tooltip={{
                                                    content: <>Reset the entire board</>,
                                                }}
                                            >
                                                <Icon path={arrowPath} class="h-4 w-4" />
                                                <span>RESET</span>
                                            </button>
                                        </div>
                                        <DraftTable />
                                    </div>
                                </Match>
                                <Match
                                    when={
                                        currentDraftView().type === "analysis"
                                    }
                                >
                                    <div class="py-5 px-4 xl:px-8 h-full overflow-y-auto">
                                        <AnalysisView />
                                    </div>
                                </Match>
                                <Match
                                    when={currentDraftView().type === "builds"}
                                >
                                    <BuildsView />
                                </Match>
                            </Switch>
                        </div>
                    </Match>
                </Switch>
            </div>
        );
    };

    const mobileTab = () => {
        const current = currentDraftView();
        if (current.type === "draft") {
            return current.subType;
        }
        return undefined;
    };

    return (
        <div
            class="h-screen flex flex-col"
            style={{
                height: "calc(var(--vh, 1vh) * 100)",
            }}
        >
            <UpdateDialog />
            <Dialog open={showFAQ()} onOpenChange={setShowFAQ}>
                <FAQDialog />
            </Dialog>
            <header class="bg-primary px-4 py-1 border-b border-neutral-800 flex items-center justify-between relative overflow-hidden">
                <div class="flex-1 hidden md:block" />
                <div class="flex-initial flex items-center justify-center">
                    <img src="/vantage_logo.png" alt="VANTAGE" class="h-24 -my-7.5 w-auto object-contain select-none mix-blend-screen" />
                </div>
                <div class="flex-1 flex items-center justify-end gap-4">
                    <div class="hidden md:flex flex-col items-end gap-1 select-none">
                        <Show
                            when={isPro() && dataset()?.proMeta}
                            fallback={
                                <div class="flex items-center gap-1.5 text-xs">
                                    {/* Rank Tier Badge */}
                                    <span
                                        class="px-2 py-0.5 rounded bg-cyan-950/40 text-secondary border border-secondary/30 font-title font-bold text-[11px] tracking-wider shadow-[0_0_8px_rgba(0,243,255,0.12)] uppercase"
                                        title={`Rank tier: ${displayNameByTier[config.tier ?? DEFAULT_TIER]}`}
                                    >
                                        {displayNameByTier[config.tier ?? DEFAULT_TIER]}
                                    </span>

                                    {/* Patch & Games Badge */}
                                    <span
                                        class="px-2 py-0.5 rounded bg-neutral-900/90 text-neutral-300 border border-neutral-800 font-mono text-[10px] tracking-wider uppercase"
                                        title={`${formatCount(currentGames())} games recorded on this patch${
                                            patchVolumePct() !== undefined
                                                ? ` (~${patchVolumePct()}% of the 30-day sample)`
                                                : ""
                                        }. Base win rates are smoothed toward the 30-day average.`}
                                    >
                                        Patch {dataset()?.version ?? ""} · {formatCount(currentGames())} games
                                    </span>

                                    {/* Thin Sample Alert Tag */}
                                    <Show
                                        when={
                                            patchVolumePct() !== undefined &&
                                            patchVolumePct()! < 25
                                        }
                                    >
                                        <span class="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] font-mono tracking-widest uppercase font-bold flex items-center gap-1">
                                            <span class="w-1 h-1 rounded-full bg-amber-400 animate-ping" />
                                            Thin
                                        </span>
                                    </Show>

                                    {/* Telemetry Timestamp */}
                                    <span class="pl-1 text-[10px] font-mono text-neutral-400 uppercase flex items-center gap-1">
                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        Updated {timeAgo()}
                                    </span>
                                </div>
                            }
                        >
                            <div class="flex items-center gap-1.5 text-xs">
                                <span class="px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-500/30 font-title font-bold text-[11px] tracking-wider uppercase">
                                    PRO DATA
                                </span>
                                <span class="px-2 py-0.5 rounded bg-neutral-900/90 text-neutral-300 border border-neutral-800 font-mono text-[10px] tracking-wider uppercase">
                                    {dataset()!.proMeta!.matches.toLocaleString()} games · {patchSummary(dataset()!.proMeta!.patches)}
                                </span>
                                <span class="text-[10px] font-mono text-neutral-400 uppercase flex items-center gap-1">
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    {leagueSummary(dataset()!.proMeta!.leagues)} · Built {timeAgo()}
                                </span>
                            </div>
                        </Show>
                    </div>
                    <Dialog
                        open={showDownloadModal()}
                        onOpenChange={setShowDownloadModal}
                    >
                        <DesktopAppDialog open={showDownloadModal()} />
                    </Dialog>
                    <div class="flex gap-1">
                        <LanguageDropdownMenu />
                        <Dialog
                            open={showSettings()}
                            onOpenChange={setShowSettings}
                        >
                            <DialogTrigger
                                class={cn(
                                    buttonVariants({
                                        variant: "transparent",
                                    }),
                                    "px-1 py-2",
                                )}
                            >
                                <Icon path={cog_6Tooth} class="w-7" />
                            </DialogTrigger>
                            <SettingsDialog />
                        </Dialog>
                        <OptionsDropdownMenu
                            setShowSettings={setShowSettings}
                            setShowFAQ={setShowFAQ}
                        />
                    </div>
                </div>
            </header>
            {/* Desktop main */}
            <main
                class="h-full lg:grid overflow-hidden hidden"
                style={{
                    "grid-template-columns": "320px 1fr 320px",
                    "grid-template-rows": "100%",
                }}
            >
                <TeamSidebar team="ally" />

                <MainView />

                <TeamSidebar team="opponent" />
            </main>

            {/* Mobile main */}
            <main class="h-full overflow-hidden lg:hidden">
                <Switch>
                    <Match when={mobileTab() === "ally"}>
                        <TeamSidebar team="ally" />
                    </Match>
                    <Match when={mobileTab() === "opponent"}>
                        <TeamSidebar team="opponent" />
                    </Match>
                    <Match when={true}>
                        <MainView />
                    </Match>
                </Switch>
            </main>

            {/* Mobile footers */}
            <Show when={mobileTab() !== undefined}>
                <footer class="bg-primary px-4 py-2 border-t-2 border-neutral-700 flex justify-evenly lg:hidden gap-4">
                    <For each={["ally", "draft", "opponent"] as const}>
                        {(view) => (
                            <Badge
                                as="button"
                                onClick={() =>
                                    setCurrentDraftView({
                                        type: "draft",
                                        subType: view,
                                    })
                                }
                                theme={
                                    mobileTab() === view
                                        ? "primary"
                                        : "secondary"
                                }
                                class="w-1/3"
                            >
                                {view}
                            </Badge>
                        )}
                    </For>
                </footer>
            </Show>
        </div>
    );
};

export default App;
