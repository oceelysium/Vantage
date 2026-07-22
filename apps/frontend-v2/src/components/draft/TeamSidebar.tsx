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

    const getSmoothWinrateColor = (ratingVal: number | undefined): string => {
        const winrate = ratingVal !== undefined ? ratingToWinrate(ratingVal) : 0.5;
        const wr = Math.max(0.40, Math.min(0.60, winrate));
        
        interface ColorStop {
            wr: number;
            r: number;
            g: number;
            b: number;
        }
        
        const stops: ColorStop[] = [
            { wr: 0.40, r: 185, g: 28, b: 28 },    // deep red
            { wr: 0.46, r: 253, g: 164, b: 175 },  // light rose
            { wr: 0.50, r: 148, g: 163, b: 184 },  // slate grey
            { wr: 0.53, r: 46, g: 204, b: 113 },   // vibrant green
            { wr: 0.56, r: 255, g: 159, b: 0 },    // warm gold
            { wr: 0.60, r: 250, g: 204, b: 21 }    // bright yellow
        ];
        
        let lower = stops[0];
        let upper = stops[stops.length - 1];
        
        for (let i = 0; i < stops.length - 1; i++) {
            if (wr >= stops[i].wr && wr <= stops[i+1].wr) {
                lower = stops[i];
                upper = stops[i+1];
                break;
            }
        }
        
        const range = upper.wr - lower.wr;
        const factor = range === 0 ? 0 : (wr - lower.wr) / range;
        
        const r = Math.round(lower.r + factor * (upper.r - lower.r));
        const g = Math.round(lower.g + factor * (upper.g - lower.g));
        const b = Math.round(lower.b + factor * (upper.b - lower.b));
        
        return `rgb(${r}, ${g}, ${b})`;
    };

    return (
        <div class="bg-primary flex flex-col h-full relative">
            <DamageDistributionBar team={props.team} />
            <div class="py-5 h-[270px] min-h-[270px] flex flex-col justify-center items-center bg-neutral-950 border-y border-neutral-700">
                <span
                    class="text-xs uppercase font-title font-bold tracking-widest text-neutral-500 mb-1.5"
                    // @ts-ignore
                    use:tooltip={{
                        content: (
                            <>{capitalize(props.team)} estimated winrate</>
                        ),
                    }}
                >
                    {props.team.toUpperCase()}
                </span>
                <span
                    class="font-header text-[3.5rem] font-bold tracking-tight leading-none transition-colors duration-500"
                    style={{
                        color: getSmoothWinrateColor(rating()),
                        "font-variant-numeric": "tabular-nums",
                    }}
                >
                    <CountUp
                        value={rating() ? ratingToWinrate(rating()!) : 0.5}
                        formatFn={(value) => (value * 100).toFixed(2)}
                    />
                </span>
                <Show when={(stdError() ?? 0) > 0.0005}>
                    <span class="text-xs font-mono text-neutral-500 mt-1.5">
                        ± {((stdError() ?? 0) * 100).toFixed(1)}
                    </span>
                </Show>
            </div>
            <For each={[0, 1, 2, 3, 4]}>
                {(index) => <Pick team={props.team} index={index} />}
            </For>
            <TeamOptions team={props.team} />
        </div>
    );
}
