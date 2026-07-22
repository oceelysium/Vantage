import { Show } from "solid-js";
import { Team } from "@draftgap/core/src/models/Team";
import { useDraftAnalysis } from "../../contexts/DraftAnalysisContext";
import { tooltip } from "../../directives/tooltip";

// eslint-disable-next-line
tooltip;

export function DamageDistributionBar(props: { team: Team }) {
    const { allyDamageDistribution, opponentDamageDistribution } =
        useDraftAnalysis();

    const damageDistribution = () =>
        props.team === "ally"
            ? allyDamageDistribution()
            : opponentDamageDistribution();

    const totalDamage = () => {
        const dist = damageDistribution();
        if (!dist) return 0;
        return dist.magic + dist.physical + dist.true;
    };

    const magicPercentage = () => {
        const total = totalDamage();
        if (total === 0) return 0;
        return damageDistribution()!.magic / total;
    };

    const physicalPercentage = () => {
        const total = totalDamage();
        if (total === 0) return 0;
        return damageDistribution()!.physical / total;
    };

    const truePercentage = () => {
        const total = totalDamage();
        if (total === 0) return 0;
        return damageDistribution()!.true / total;
    };

    return (
        <Show
            when={
                damageDistribution() &&
                totalDamage() > 0
            }
        >
            <div
                class="absolute right-0 left-0 top-0 w-full flex h-[5px] hover:h-[12px] transition-all duration-200 cursor-help z-20"
                // @ts-ignore
                use:tooltip={{
                    content: (
                        <div class="font-mono text-[10px] p-1 flex items-center gap-2">
                            <span class="text-opponent font-bold">AD: {Math.round(physicalPercentage() * 100)}%</span>
                            <span class="text-neutral-600">|</span>
                            <span class="text-ally font-bold">AP: {Math.round(magicPercentage() * 100)}%</span>
                            <span class="text-neutral-600">|</span>
                            <span class="text-neutral-300 font-bold">TRUE: {Math.round(truePercentage() * 100)}%</span>
                        </div>
                    ),
                }}
            >
                <div
                    class="bg-opponent transition-all duration-500"
                    style={{ width: physicalPercentage() * 100 + "%" }}
                />
                <div
                    class="bg-ally transition-all duration-500"
                    style={{ width: magicPercentage() * 100 + "%" }}
                />
                <div
                    class="bg-neutral-300 transition-all duration-500"
                    style={{ width: truePercentage() * 100 + "%" }}
                />
            </div>
        </Show>
    );
}
