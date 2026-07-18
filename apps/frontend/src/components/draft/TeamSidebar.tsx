import { For, Show } from "solid-js";
import { ratingToWinrate } from "@draftgap/core/src/rating/ratings";
import { CountUp } from "../CountUp";
import { DamageDistributionBar } from "./DamageDistributionBar";
import { Pick } from "./Pick";
import { TeamOptions } from "./TeamOptions";
import { tooltip } from "../../directives/tooltip";
import { capitalize } from "../../utils/strings";
import { getRatingClass } from "../../utils/rating";
import { useDraftAnalysis } from "../../contexts/DraftAnalysisContext";
// eslint-disable-next-line
tooltip;

interface IProps {
    team: "ally" | "opponent";
}

export function TeamSidebar(props: IProps) {
    const {
        allyDraftAnalysis: allyDraftResult,
        opponentDraftAnalysis: opponentDraftResult,
    } = useDraftAnalysis();

    const rating = () =>
        props.team === "ally"
            ? allyDraftResult()?.totalRating
            : opponentDraftResult()?.totalRating;

    const stdError = () =>
        props.team === "ally"
            ? allyDraftResult()?.winrateStdError
            : opponentDraftResult()?.winrateStdError;

    return (
        <div class="bg-primary flex flex-col h-full relative">
            <DamageDistributionBar team={props.team} />
            <div class="flex-1 flex justify-center items-center bg-neutral-950 border-y border-neutral-700">
                <span
                    class="font-display text-[2.75rem] text-center leading-tight tracking-wide"
                    // @ts-ignore
                    use:tooltip={{
                        content: (
                            <>{capitalize(props.team)} estimated winrate</>
                        ),
                    }}
                >
                    {props.team.toUpperCase()}
                    <br />
                    <CountUp
                        value={rating() ? ratingToWinrate(rating()!) : 0.5}
                        formatFn={(value) => (value * 100).toFixed(2)}
                        class={`font-header tracking-normal ${getRatingClass(
                            rating() ?? 0,
                        )} transition-colors duration-500`}
                        style={{
                            "font-variant-numeric": "tabular-nums",
                        }}
                    />
                    <Show when={(stdError() ?? 0) > 0.0005}>
                        <span class="block font-body text-sm font-normal normal-case tracking-normal text-neutral-500 mt-0.5">
                            ± {((stdError() ?? 0) * 100).toFixed(1)}
                        </span>
                    </Show>
                </span>
            </div>
            <For each={[0, 1, 2, 3, 4]}>
                {(index) => <Pick team={props.team} index={index} />}
            </For>
            <TeamOptions team={props.team} />
        </div>
    );
}
