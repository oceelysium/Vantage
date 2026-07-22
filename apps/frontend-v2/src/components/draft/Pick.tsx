import { Icon } from "solid-heroicons";
import { openUrl } from "@tauri-apps/plugin-opener";
import { For, Show } from "solid-js";
import { useDraft } from "../../contexts/DraftContext";
import { RoleIcon } from "../icons/roles/RoleIcon";
import { PickOptions } from "./PickOptions";
import { lockOpen, lockClosed } from "solid-heroicons/solid-mini";
import { Role, ROLES } from "@draftgap/core/src/models/Role";
import { formatPercentage } from "../../utils/rating";
import { tooltip } from "../../directives/tooltip";
import { useTooltip } from "../../contexts/TooltipContext";
import { linkByStatsSite } from "../../utils/sites";
import { useUser } from "../../contexts/UserContext";
import { useDraftAnalysis } from "../../contexts/DraftAnalysisContext";
import { championName } from "../../utils/i18n";
import { useMedia } from "../../hooks/useMedia";
// eslint-disable-next-line
tooltip;

type Props = {
    team: "ally" | "opponent";
    index: number;
};

export function Pick(props: Props) {
    const { config } = useUser();
    const { allyTeam, opponentTeam, selection, select, pickChampion } =
        useDraft();

    const { isDesktop } = useMedia();

    const team = () => (props.team === "ally" ? allyTeam : opponentTeam);

    const {
        allyTeamComp,
        opponentTeamComp,
        allyTeamData,
        opponentTeamData,
        setAnalysisPick,
        analyzeHovers,
    } = useDraftAnalysis();

    const { setPopoverVisible } = useTooltip();
    const picks = () => (props.team === "ally" ? allyTeam : opponentTeam);
    const championData = () =>
        props.team === "ally" ? allyTeamData() : opponentTeamData();
    const teamComp = () =>
        props.team === "ally" ? allyTeamComp() : opponentTeamComp();

    const pick = () => picks()[props.index];
    const teamCompRole = () =>
        [...(teamComp()?.entries() ?? [])].find(
            (e) => e[1] === pick().championKey,
        )?.[0];

    const isSelected = () =>
        selection.team === props.team && selection.index === props.index;

    const champion = () => {
        if (pick().championKey) {
            return championData().get(pick().championKey!);
        }

        if (pick().hoverKey && analyzeHovers()) {
            return championData().get(pick().hoverKey!);
        }

        return undefined;
    };

    function setRole(role: Role | undefined) {
        pickChampion(props.team, props.index, pick().championKey, role);
    }

    const keyDownListener = (e: KeyboardEvent) => {
        if (e.ctrlKey || e.altKey || e.metaKey) {
            return;
        }

        if ((e.target as HTMLElement).tagName === "INPUT") {
            return;
        }

        if (e.key === "b") {
            if (!champion()) {
                return;
            }
            e.preventDefault();

            const link = linkByStatsSite(
                config.defaultStatsSite,
                champion()!.id,
                [...teamComp().entries()].find(
                    ([, value]) => value === pick().championKey,
                )![0] as Role,
            );
            if (isDesktop) {
                openUrl(link);
            } else {
                window.open(link, "_blank");
            }
        } else if (
            e.key === "r" ||
            e.key === "Backspace" ||
            e.key === "Delete"
        ) {
            e.preventDefault();
            pickChampion(props.team, props.index, undefined, undefined);
        } else if (e.key === "f") {
            setAnalysisPick({
                team: props.team,
                championKey: team()[props.index].championKey!,
            });
        } else if (e.key === "1") {
            e.preventDefault();
            setRole(pick().role === Role.Top ? undefined : Role.Top);
        } else if (e.key === "2") {
            e.preventDefault();
            setRole(pick().role === Role.Jungle ? undefined : Role.Jungle);
        } else if (e.key === "3") {
            e.preventDefault();
            setRole(pick().role === Role.Middle ? undefined : Role.Middle);
        } else if (e.key === "4") {
            e.preventDefault();
            setRole(pick().role === Role.Bottom ? undefined : Role.Bottom);
        } else if (e.key === "5") {
            e.preventDefault();
            setRole(pick().role === Role.Support ? undefined : Role.Support);
        }
    };

    function onMouseOver() {
        document.addEventListener("keydown", keyDownListener);
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && activeEl.id === "draftTableSearch") {
            activeEl.blur();
        }
    }

    function onMouseOut() {
        document.removeEventListener("keydown", keyDownListener);
    }

    return (
        <div
            class="flex-1 relative min-h-[90px] rounded border transition-all duration-200 ease-in-out cursor-pointer overflow-hidden flex flex-col justify-between"
            classList={{
                "border-neutral-700 bg-neutral-900/40 hover:bg-neutral-800/40 hover:border-neutral-500": !isSelected(),
                "bg-neutral-900/60": isSelected(),
                "border-ally shadow-[0_0_10px_rgba(99,102,241,0.25)]": isSelected() && props.team === "ally",
                "border-opponent shadow-[0_0_10px_rgba(255,70,85,0.25)]": isSelected() && props.team === "opponent",
                "border-l-2 border-l-ally": props.team === "ally" && !isSelected(),
                "border-r-2 border-r-opponent": props.team === "opponent" && !isSelected(),
            }}
            onClick={() => select(props.team, props.index)}
            onMouseOver={onMouseOver}
            onMouseOut={onMouseOut}
        >
            {/* Pulsing Selection Overlay */}
            <Show when={isSelected()}>
                <div
                    class="absolute inset-0 pointer-events-none animate-pulse z-0"
                    classList={{
                        "bg-ally/[0.08]": props.team === "ally",
                        "bg-opponent/[0.08]": props.team === "opponent",
                    }}
                />
            </Show>
            <Show when={!champion()}>
                <div class="absolute inset-0 flex flex-col justify-center items-center p-2">
                    <span class="text-[10px] font-title font-bold text-neutral-500 tracking-widest uppercase">
                        PICK {props.index + 1}
                    </span>
                    <span class="text-[8px] text-neutral-600 font-mono mt-0.5">EMPTY</span>
                </div>
            </Show>

            <Show when={champion()}>
                <>
                    <div
                        class="absolute top-0 bottom-0 left-0 h-full w-full pointer-events-none"
                        style={{
                            "background-image": `linear-gradient(to right, rgba(8, 9, 11, 0.8) 15%, rgba(8, 9, 11, 0.15) 55%, rgba(8, 9, 11, 0.6) 100%),
                                url(https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${
                                    champion()!.id === "Fiddlesticks"
                                        ? "FiddleSticks"
                                        : champion()!.id
                                }_0.jpg)`,
                            "background-position": "center 20%",
                            "background-size": "cover",
                            filter: pick().hoverKey
                                ? "grayscale(0.5) brightness(0.7)"
                                : "brightness(1.05) contrast(1.05)",
                        }}
                    />

                    <div class="p-2 relative z-5 flex flex-col h-full justify-between pointer-events-none">
                        <div class="flex justify-between items-start w-full">
                            <span class="font-title text-xs font-bold text-neutral-100 tracking-wide truncate max-w-[100px]">
                                {championName(champion()!, config)}
                            </span>
                            <Show when={pick().hoverKey}>
                                <span class="text-[7px] bg-yellow-500/20 text-yellow-400 px-1 py-0.5 rounded font-mono uppercase tracking-wider scale-90">Hover</span>
                            </Show>
                        </div>

                        <div class="flex justify-end gap-1 items-center pointer-events-auto">
                            <For each={pick().role !== undefined ? [pick().role!] : ROLES}>
                                {(role) => {
                                    const probability = () => champion()?.probabilityByRole.get(role) ?? 0;
                                    return (
                                        <div
                                            class="flex flex-col items-center relative group mx-[0.2rem] cursor-pointer text-neutral-400"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPopoverVisible(false);
                                                setRole(
                                                    pick().role === role
                                                        ? undefined
                                                        : role,
                                                );
                                            }}
                                            // @ts-ignore
                                            use:tooltip={{
                                                content: (
                                                    <>
                                                        {pick().role === role
                                                            ? "Champion is locked in this role. Click to unlock."
                                                            : `Click to lock champion in this role (Play Rate: ${(probability() * 100).toFixed(1)}%).`}
                                                    </>
                                                ),
                                            }}
                                        >
                                            <div class="text-xs">
                                                <RoleIcon
                                                    role={role}
                                                    class="h-6 w-6"
                                                    classList={{
                                                        "opacity-45 group-hover:opacity-80":
                                                            teamCompRole() !== role,
                                                        "opacity-100":
                                                            teamCompRole() === role,
                                                        "text-ally":
                                                            teamCompRole() === role && props.team === "ally",
                                                        "text-opponent":
                                                            teamCompRole() === role && props.team === "opponent",
                                                    }}
                                                />
                                            </div>
                                            <Icon
                                                path={
                                                    pick().role === undefined
                                                        ? lockOpen
                                                        : lockClosed
                                                }
                                                class="absolute -top-1 -right-1 w-[12px] h-[12px]"
                                                classList={{
                                                    "opacity-0 group-hover:opacity-100 text-neutral-400":
                                                        pick().role === undefined,
                                                    "opacity-100":
                                                        pick().role !== undefined,
                                                    "text-ally":
                                                        pick().role !== undefined && props.team === "ally",
                                                    "text-opponent":
                                                        pick().role !== undefined && props.team === "opponent",
                                                }}
                                            />
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    </div>
                </>
            </Show>

            <div class="absolute right-1 bottom-1">
                <PickOptions team={props.team} index={props.index} />
            </div>
        </div>
    );
}
