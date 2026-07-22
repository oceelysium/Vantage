import { Icon } from "solid-heroicons";
import {
    arrowsRightLeft,
    users,
    user,
    presentationChartLine,
} from "solid-heroicons/solid";
import { JSX } from "solid-js/jsx-runtime";
import { Team } from "@draftgap/core/src/models/Team";
import { tooltip } from "../../../directives/tooltip";
import { RatingText } from "../../common/RatingText";
import { Component, Show } from "solid-js";
import { capitalize } from "../../../utils/strings";
import { useDraftAnalysis } from "../../../contexts/DraftAnalysisContext";
import { useDataset } from "../../../contexts/DatasetContext";
import { cn } from "../../../utils/style";
// eslint-disable-next-line
tooltip;

export const SummaryCard = (
    props: {
        team?: Team;
        title: string;
        icon: {
            path: JSX.Element;
            outline: boolean;
            mini: boolean;
        };
        rating?: number;
        number?: number;
        href?: string;
        tooltip: JSX.Element;
    } & JSX.HTMLAttributes<HTMLDivElement>,
) => {
    const isAlly = () => props.team === "ally";

    return (
        <a
            {...props}
            class={cn(
                "px-5 py-4 flex gap-4 items-center text-left rounded-lg bg-neutral-900/40 border border-neutral-800/80 hover:border-neutral-700 transition duration-150 relative overflow-hidden group",
                props.class,
            )}
            // @ts-ignore
            use:tooltip={{
                content: props.tooltip,
            }}
        >
            {/* Corner Decorative Tech Border */}
            <div class="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-neutral-700 pointer-events-none"></div>

            <div
                class={cn(
                    "rounded-full h-[40px] w-[40px] flex items-center justify-center border transition-all duration-200",
                    props.team === undefined
                        ? "bg-neutral-800/50 border-neutral-700 text-neutral-400 group-hover:bg-neutral-800 group-hover:border-neutral-600"
                        : isAlly()
                        ? "bg-ally/10 border-ally/30 text-ally group-hover:bg-ally/20 group-hover:border-ally/50"
                        : "bg-opponent/10 border-opponent/30 text-opponent group-hover:bg-opponent/20 group-hover:border-opponent/50"
                )}
            >
                <Icon path={props.icon} class="w-5 h-5" />
            </div>
            <div>
                <div class="text-[10px] text-neutral-500 uppercase tracking-widest font-title">
                    {props.title}
                </div>
                <div class="flex items-baseline -mt-0.5">
                    <div class="text-xl font-title font-bold tracking-tight">
                        <Show
                            when={props.rating !== undefined}
                            fallback={props.number}
                        >
                            <RatingText rating={props.rating!} />
                        </Show>
                    </div>
                </div>
            </div>
        </a>
    );
};

export const DraftSummaryCards = (
    props: { team: Team } & JSX.HTMLAttributes<HTMLDivElement>,
) => {
    const { allyDraftAnalysis, opponentDraftAnalysis } = useDraftAnalysis();

    const draftResult = () =>
        props.team === "ally" ? allyDraftAnalysis()! : opponentDraftAnalysis()!;

    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    return (
        <div class="space-y-2" {...props}>
            <div class="text-xs font-title font-bold text-neutral-400 tracking-widest uppercase px-1">
                {capitalize(props.team)} Overview
            </div>
            <div
                class={cn(
                    "grid grid-cols-2 md:grid-cols-4 gap-3 overflow-hidden",
                    props.class,
                )}
            >
                <SummaryCard
                    team={props.team}
                    icon={user}
                    title="Champions"
                    rating={draftResult().allyChampionRating.totalRating}
                    href="#champions-result"
                    tooltip={
                        <>
                            {capitalize(props.team)} estimated winrate when only
                            taking into account {props.team} champions
                        </>
                    }
                />
                <SummaryCard
                    team={props.team}
                    icon={arrowsRightLeft}
                    title="Matchups"
                    rating={draftResult().matchupRating.totalRating}
                    href="#matchup-result"
                    tooltip={
                        <>
                            {capitalize(props.team)} estimated winrate when only
                            taking into account matchups between the two teams
                        </>
                    }
                />
                <SummaryCard
                    team={props.team}
                    icon={users}
                    title="Duos"
                    rating={draftResult().allyDuoRating.totalRating}
                    href="#duo-result"
                    tooltip={
                        <>
                            {capitalize(props.team)} estimated winrate when only
                            taking into account {props.team} duos
                        </>
                    }
                />
                <SummaryCard
                    team={props.team}
                    icon={presentationChartLine}
                    title="Winrate"
                    rating={draftResult().totalRating}
                    href="#total-result"
                    tooltip={
                        <>
                            {capitalize(props.team)} estimated winrate, taking into
                            account all factors: ally champions and duos, as well as
                            opponent champions and duos and all matchups
                        </>
                    }
                />
            </div>
        </div>
    );
};

type ChampionSummaryCardProps = {
    championKey: string;
    team: Team;
} & JSX.HTMLAttributes<HTMLDivElement>;

export const ChampionSummaryCards: Component<ChampionSummaryCardProps> = (
    props,
) => {
    const { dataset } = useDataset();
    const { allyDraftAnalysis, opponentDraftAnalysis } = useDraftAnalysis();

    const draftResult = () =>
        props.team === "ally" ? allyDraftAnalysis()! : opponentDraftAnalysis()!;

    const name = () => dataset()!.championData[props.championKey].name;

    const baseChampionRating = () =>
        draftResult().allyChampionRating.championResults.find(
            (r) => r.championKey === props.championKey,
        )?.rating ?? 0;

    const duoRating = () =>
        draftResult()
            .allyDuoRating.duoResults.filter(
                (r) =>
                    r.championKeyA === props.championKey ||
                    r.championKeyB === props.championKey,
            )
            .reduce((acc, r) => acc + r.rating / 2, 0);

    const matchupRating = () =>
        draftResult()
            .matchupRating.matchupResults.filter(
                (r) =>
                    r.championKeyA === props.championKey ||
                    r.championKeyB === props.championKey,
            )
            .reduce((acc, r) => acc + r.rating, 0);

    const totalRating = () =>
        baseChampionRating() + duoRating() + matchupRating();

    return (
        <div
            {...props}
            class={cn(
                "grid overflow-hidden grid-cols-2 sm:grid-cols-4 gap-3",
                props.class,
            )}
        >
            <SummaryCard
                class="py-2!"
                icon={user}
                title="Champion"
                rating={baseChampionRating()}
                tooltip={<>{capitalize(name())} base winrate</>}
            />
            <SummaryCard
                class="py-2!"
                icon={arrowsRightLeft}
                title="Matchups"
                rating={matchupRating()}
                href="#matchup-champion-result"
                tooltip={
                    <>
                        {capitalize(name())} estimated winrate when taking into
                        account all {name()} matchups with opponent champions
                    </>
                }
            />
            <SummaryCard
                class="py-2!"
                icon={users}
                title="Duos"
                rating={duoRating()}
                href="#duo-champion-result"
                tooltip={
                    <>
                        {capitalize(name())} estimated winrate when taking into
                        account all {name()} duos with ally champions
                    </>
                }
            />
            <SummaryCard
                class="py-2!"
                icon={presentationChartLine}
                title="Winrate"
                rating={totalRating()}
                tooltip={
                    <>
                        {capitalize(name())} contribution to winrate in draft,
                        taking into account: {name()} base winrate, {name()}{" "}
                        duos, and {name()} matchups
                    </>
                }
            />
        </div>
    );
};
