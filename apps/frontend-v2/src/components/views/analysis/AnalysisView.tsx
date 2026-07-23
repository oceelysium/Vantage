import { createSignal, Match, Show, Switch } from "solid-js";
import { ButtonGroup } from "../../common/ButtonGroup";
import { Team } from "@draftgap/core/src/models/Team";
import { useUser } from "../../../contexts/UserContext";
import { useDraftAnalysis } from "../../../contexts/DraftAnalysisContext";
import { useDraft } from "../../../contexts/DraftContext";
import { WinrateWaterfallCard } from "./WinrateWaterfallCard";
import { SwingFactorsCard } from "./SwingFactorsCard";
import { ChampionContributionBars } from "./ChampionContributionBars";
import { LaneDuelsCard } from "./LaneDuelsCard";
import { TotalChampionContributionTable } from "./TotalChampionContributionTable";
import { IndividualChampionsResultTable } from "./IndividualChampionsResultTable";
import { MatchupResultTable } from "./MatchupResultTable";
import { DuoResultTable } from "./DuoResultTable";
import { ScalingChart } from "./ScalingChart";
import { tooltip } from "../../../directives/tooltip";
// eslint-disable-next-line
tooltip;

type ViewMode = "story" | "tables";

export default function AnalysisView() {
    const { config } = useUser();
    const { setAnalysisPick } = useDraftAnalysis();
    const { draftFinished } = useDraft();

    const [activeTeam, setActiveTeam] = createSignal<Team>("ally");
    const [viewMode, setViewMode] = createSignal<ViewMode>("story");
    const [showAllMatchups, setShowAllMatchups] = createSignal(false);

    const openChampionDraftAnalysisModal = (
        team: Team,
        championKey: string,
    ) => {
        setAnalysisPick({ team, championKey });
    };

    return (
        <div class="space-y-6 pb-12">
            {/* Top Control Bar: Perspective & View Mode */}
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80 shadow-md">
                {/* Team Perspective Selector */}
                <div class="flex items-center gap-3">
                    <span class="text-xs font-title font-bold uppercase tracking-wider text-neutral-400">
                        Perspective
                    </span>
                    <ButtonGroup
                        options={[
                            { label: "ALLY TEAM", value: "ally" as const },
                            { label: "OPPONENT", value: "opponent" as const },
                        ]}
                        size="sm"
                        selected={activeTeam()}
                        onChange={setActiveTeam}
                    />
                </div>

                {/* View Mode Toggle (Story & Drivers vs Raw Tables) */}
                <div class="flex items-center gap-3 self-end sm:self-auto">
                    <span class="text-xs font-title font-bold uppercase tracking-wider text-neutral-400">
                        Display Mode
                    </span>
                    <ButtonGroup
                        options={[
                            { label: "STORY & DRIVERS", value: "story" as const },
                            { label: "RAW DATA TABLES", value: "tables" as const },
                        ]}
                        size="sm"
                        selected={viewMode()}
                        onChange={setViewMode}
                    />
                </div>
            </div>

            {/* Main Content Area */}
            <Switch>
                {/* Mode A: Story & Dynamic HUD View */}
                <Match when={viewMode() === "story"}>
                    <div class="space-y-6">
                        {/* Top Story Layer: Waterfall & Swing Factors */}
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <WinrateWaterfallCard team={activeTeam()} />
                            <SwingFactorsCard team={activeTeam()} />
                        </div>

                        {/* Diverging Champion Impact Ranking */}
                        <ChampionContributionBars
                            team={activeTeam()}
                            onClickChampion={(championKey) =>
                                openChampionDraftAnalysisModal(
                                    activeTeam(),
                                    championKey,
                                )
                            }
                        />

                        {/* Head-to-Head Lane Duels & Duos */}
                        <LaneDuelsCard
                            onClickChampion={(team, championKey) =>
                                openChampionDraftAnalysisModal(team, championKey)
                            }
                        />
                    </div>
                </Match>

                {/* Mode B: Detailed Data Tables View */}
                <Match when={viewMode() === "tables"}>
                    <div class="space-y-8">
                        {/* Overview Tables */}
                        <div
                            class="flex-col md:flex-row flex gap-4 overflow-hidden"
                            id="total-result"
                        >
                            <div class="md:w-1/2">
                                <h3 class="text-xl font-title font-bold uppercase mb-2 text-neutral-300">
                                    Ally Overview
                                </h3>
                                <TotalChampionContributionTable
                                    team="ally"
                                    onClickChampion={(key) =>
                                        openChampionDraftAnalysisModal("ally", key)
                                    }
                                />
                            </div>
                            <div class="md:w-1/2">
                                <h3 class="text-xl font-title font-bold uppercase mb-2 text-neutral-300">
                                    Opponent Overview
                                </h3>
                                <TotalChampionContributionTable
                                    team="opponent"
                                    onClickChampion={(key) =>
                                        openChampionDraftAnalysisModal(
                                            "opponent",
                                            key,
                                        )
                                    }
                                />
                            </div>
                        </div>

                        {/* Base Champion Winrates */}
                        <Show when={!config.ignoreChampionWinrates}>
                            <div
                                class="flex-col flex sm:flex-row gap-4"
                                id="champions-result"
                            >
                                <div class="sm:w-1/2">
                                    <h3 class="text-xl font-title font-bold uppercase mb-2 text-neutral-300">
                                        Ally Champions
                                    </h3>
                                    <IndividualChampionsResultTable
                                        team="ally"
                                        onClickChampion={(championKey) =>
                                            openChampionDraftAnalysisModal(
                                                "ally",
                                                championKey,
                                            )
                                        }
                                    />
                                </div>
                                <div class="sm:w-1/2">
                                    <h3 class="text-xl font-title font-bold uppercase mb-2 text-neutral-300">
                                        Opponent Champions
                                    </h3>
                                    <IndividualChampionsResultTable
                                        team="opponent"
                                        onClickChampion={(championKey) =>
                                            openChampionDraftAnalysisModal(
                                                "opponent",
                                                championKey,
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        </Show>

                        {/* Matchups Table */}
                        <div>
                            <div
                                class="flex flex-row justify-between items-center mb-2"
                                id="matchup-result"
                            >
                                <div>
                                    <h3 class="text-xl font-title font-bold uppercase text-neutral-300">
                                        Matchups
                                    </h3>
                                    <p class="text-xs text-neutral-500 uppercase">
                                        Champion winrates normalized
                                    </p>
                                </div>
                                <ButtonGroup
                                    options={[
                                        { label: "HEAD 2 HEAD", value: false },
                                        { label: "ALL", value: true },
                                    ]}
                                    size="sm"
                                    selected={showAllMatchups()}
                                    onChange={setShowAllMatchups}
                                />
                            </div>
                            <MatchupResultTable
                                class="w-full"
                                showAll={showAllMatchups()}
                                onClickChampion={(team, championKey) =>
                                    openChampionDraftAnalysisModal(
                                        team,
                                        championKey,
                                    )
                                }
                            />
                        </div>

                        {/* Duos Tables */}
                        <div
                            class="flex-col md:flex-row flex gap-4"
                            id="duo-result"
                        >
                            <div class="md:w-1/2">
                                <h3 class="text-xl font-title font-bold uppercase text-neutral-300">
                                    Ally Duos
                                </h3>
                                <p class="text-xs text-neutral-500 uppercase mb-2">
                                    Champion winrates normalized
                                </p>
                                <DuoResultTable
                                    team="ally"
                                    onClickChampion={(key) =>
                                        openChampionDraftAnalysisModal(
                                            "ally",
                                            key,
                                        )
                                    }
                                />
                            </div>
                            <div class="md:w-1/2">
                                <h3 class="text-xl font-title font-bold uppercase text-neutral-300">
                                    Opponent Duos
                                </h3>
                                <p class="text-xs text-neutral-500 uppercase mb-2">
                                    Champion winrates normalized
                                </p>
                                <DuoResultTable
                                    team="opponent"
                                    onClickChampion={(key) =>
                                        openChampionDraftAnalysisModal(
                                            "opponent",
                                            key,
                                        )
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </Match>
            </Switch>

            {/* Scaling Progression Section */}
            <Show when={draftFinished()}>
                <div class="p-5 bg-neutral-900/60 border border-neutral-800/80 rounded-xl w-full">
                    <h3 class="text-xs font-title font-bold uppercase tracking-wider text-neutral-300 mb-1">
                        Scaling Progression
                    </h3>
                    <span class="text-neutral-500 uppercase block text-[10px] font-title mb-3">
                        Team winrate normalized over game duration
                    </span>
                    <div class="mt-2 w-full">
                        <ScalingChart />
                    </div>
                </div>
            </Show>
        </div>
    );
}
