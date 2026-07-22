import { Icon } from "solid-heroicons";
import { magnifyingGlass, xMark } from "solid-heroicons/outline";
import { onCleanup, onMount, Show } from "solid-js";
import { useDraftFilters } from "../../contexts/DraftFiltersContext";
import { useUser } from "../../contexts/UserContext";
import { useDraftSuggestions } from "../../contexts/DraftSuggestionsContext";
import { useDraft } from "../../contexts/DraftContext";
import { useDataset } from "../../contexts/DatasetContext";
import { createMustSelectToast } from "../../utils/toast";

export function Search() {
    const { search, setSearch, activeIndex, setActiveIndex } = useDraftFilters();
    const { setConfig } = useUser();
    const { isLoaded } = useDataset();
    const { selection, pickChampion, allyTeam, opponentTeam } = useDraft();
    const { filteredSuggestions } = useDraftSuggestions();

    // eslint-disable-next-line prefer-const -- solid js ref
    let inputEl: HTMLInputElement | undefined = undefined;

    function onInput(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        setSearch(input.value);
        setActiveIndex(-1);
        if (input.value === "DANGEROUSLY_ENABLE_BETA_FEATURES") {
            setConfig((config) => ({ ...config, enableBetaFeatures: true }));
            setSearch("");
        }
        if (input.value === "DANGEROUSLY_DISABLE_BETA_FEATURES") {
            setConfig((config) => ({ ...config, enableBetaFeatures: false }));
            setSearch("");
        }
    }

    let lastPickAt = 0;
    function pick(suggestion: any) {
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
    }

    onMount(() => {
        if (!inputEl) return;
        const el = inputEl as HTMLInputElement;

        const onControlF = (e: KeyboardEvent) => {
            if (e.ctrlKey && (e.key === "f" || e.key == "k")) {
                e.preventDefault();
                el.focus();
            }
        };
        const onGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === "Escape") {
                if (document.activeElement !== el) {
                    e.preventDefault();
                    el.focus();
                    el.select();
                }
            }
        };
        window.addEventListener("keydown", onControlF);
        window.addEventListener("keydown", onGlobalKeyDown);

        const onInputKeyDown = (e: KeyboardEvent) => {
            const suggestions = filteredSuggestions();
            const listLength = suggestions.length;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((prev) => {
                    const next = prev + 1 >= listLength ? listLength - 1 : prev + 1;
                    const activeRow = document.getElementById("suggestion-row-" + next);
                    if (activeRow) {
                        activeRow.scrollIntoView({ block: "nearest" });
                    }
                    return next;
                });
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((prev) => {
                    const next = prev - 1 < 0 ? 0 : prev - 1;
                    const activeRow = document.getElementById("suggestion-row-" + next);
                    if (activeRow) {
                        activeRow.scrollIntoView({ block: "nearest" });
                    }
                    return next;
                });
            } else if (e.key === "Enter") {
                const activeIdx = activeIndex();
                if (activeIdx >= 0 && activeIdx < listLength) {
                    e.preventDefault();
                    const targetSuggestion = suggestions[activeIdx];
                    if (targetSuggestion) {
                        pick(targetSuggestion);
                        setActiveIndex(-1);
                    }
                }
            }
        };

        el.addEventListener("keydown", onInputKeyDown);
        onCleanup(() => {
            el.removeEventListener("keydown", onInputKeyDown);
            window.removeEventListener("keydown", onControlF);
            window.removeEventListener("keydown", onGlobalKeyDown);
        });
    });

    return (
        <div class="flex rounded-md flex-1">
            <div class="relative flex grow items-stretch">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Icon
                        path={magnifyingGlass}
                        class="h-5 w-5 text-gray-400"
                        aria-hidden="true"
                    />
                </div>
                <input
                    ref={inputEl}
                    id="draftTableSearch"
                    class="text-lg py-1 block w-full rounded-md border border-neutral-700 pl-10 bg-neutral-800 placeholder:text-neutral-500 text-neutral-100 outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/40"
                    placeholder="SEARCH"
                    value={search()}
                    onInput={onInput}
                />
                <Show when={search().length}>
                    <button
                        class="absolute inset-y-0 right-0 flex items-center pr-3"
                        onClick={() => setSearch("")}
                    >
                        <Icon
                            path={xMark}
                            class="h-5 w-5 text-gray-400"
                            aria-hidden="true"
                        />
                    </button>
                </Show>
            </div>
        </div>
    );
}
