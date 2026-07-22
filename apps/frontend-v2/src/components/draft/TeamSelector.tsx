import { For } from "solid-js";
import { useDraft } from "../../contexts/DraftContext";
import { Team } from "@draftgap/core/src/models/Team";

const TEAMS = ["ally", "opponent"] as const;

export function TeamSelector() {
    const { selection, select, allyTeam, opponentTeam } = useDraft();

    function selectTeam(team: Team) {
        const picks = team === "ally" ? allyTeam : opponentTeam;
        const index = picks.findIndex((pick) => !pick.championKey);

        select(team, index);
    }

    return (
        <span class="isolate inline-flex rounded shadow-xs overflow-hidden border border-neutral-700 font-title">
            <For each={TEAMS}>
                {(team, i) => (
                    <button
                        type="button"
                        class="text-xs relative inline-flex items-center bg-neutral-900 px-3 py-1 font-bold hover:bg-neutral-800 uppercase disabled:pointer-events-none disabled:text-neutral-700 text-neutral-400 transition-all duration-200"
                        classList={{
                            "border-r border-neutral-700": i() === 0,
                            "-ml-px": i() !== 0,
                            "text-neutral-50 bg-ally! shadow-[inset_0_0_10px_rgba(255,255,255,0.15)]":
                                selection.team === "ally" && team === "ally",
                            "text-neutral-50 bg-opponent! shadow-[inset_0_0_10px_rgba(255,255,255,0.15)]":
                                selection.team === "opponent" && team === "opponent",
                        }}
                        onClick={() => selectTeam(team)}
                        disabled={
                            (team === "ally" ? allyTeam : opponentTeam).filter(
                                (p) => p.championKey !== undefined,
                            ).length === 5
                        }
                    >
                        {team}
                    </button>
                )}
            </For>
        </span>
    );
}
