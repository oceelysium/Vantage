import {
    JSXElement,
    createContext,
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
    useContext,
} from "solid-js";
import { getSuggestions } from "@draftgap/core/src/draft/suggestions";
import { useDraftAnalysis } from "./DraftAnalysisContext";
import { useDataset } from "./DatasetContext";
import { useDraftFilters } from "./DraftFiltersContext";
import { useUser } from "./UserContext";
import { useDraft } from "./DraftContext";
import { championName } from "../utils/i18n";

const CJK = "\\u4e00-\\u9fff";
const NON_ALNUM = new RegExp(`[^a-zA-Z0-9${CJK}]`, "g");
const normalize = (s: string) => s.replace(NON_ALNUM, "").toLowerCase();

export function createDraftSuggestionsContext() {
    const { isLoaded, dataset, dataset30Days } = useDataset();
    const { draftAnalysisConfig, allyTeamComp, opponentTeamComp } =
        useDraftAnalysis();
    const { search, roleFilter, favouriteFilter } = useDraftFilters();
    const { config, isFavourite } = useUser();
    const { selection, bans, ownedChampions } = useDraft();

    // Debounced search: the visible table filters on `search()` instantly, but
    // recomputing the suggestion list (to surface searched off-meta picks) only
    // needs to happen once the user pauses typing.
    const [debouncedSearch, setDebouncedSearch] = createSignal(search());
    createEffect(() => {
        const value = search();
        const handle = setTimeout(() => setDebouncedSearch(value), 200);
        onCleanup(() => clearTimeout(handle));
    });

    // Champions matching the current search — surfaced in every role regardless
    // of sample size, so an explicitly searched off-meta pick can be entered.
    const searchedChampionKeys = createMemo<Set<string> | undefined>(() => {
        const raw = debouncedSearch();
        if (!raw) return undefined;
        const str = normalize(raw);
        if (!str) return undefined;
        const ds = dataset();
        if (!ds) return undefined;

        const keys = new Set<string>();
        for (const [key, champion] of Object.entries(ds.championData)) {
            if (
                normalize(champion.name).includes(str) ||
                normalize(championName(champion, config)).includes(str)
            ) {
                keys.add(key);
            }
        }
        return keys;
    });

    const allySuggestions = createMemo(() => {
        if (!isLoaded()) return [];

        return getSuggestions(
            dataset()!,
            dataset30Days()!,
            allyTeamComp(),
            opponentTeamComp(),
            draftAnalysisConfig(),
            searchedChampionKeys(),
        );
    });

    const opponentSuggestions = createMemo(() => {
        if (!isLoaded()) return [];

        return getSuggestions(
            dataset()!,
            dataset30Days()!,
            opponentTeamComp(),
            allyTeamComp(),
            draftAnalysisConfig(),
            searchedChampionKeys(),
        );
    });

    const suggestions = createMemo(() =>
        selection.team === "opponent"
            ? opponentSuggestions()
            : allySuggestions()
    );

    const ownsChampion = (championKey: string) =>
        ownedChampions().size === 0 || ownedChampions().has(championKey);

    const filteredSuggestions = createMemo(() => {
        let filtered = suggestions();
        if (!dataset()) {
            return filtered;
        }

        if (search()) {
            const str = search()
                .replaceAll(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "")
                .toLowerCase();
            filtered = filtered.filter((s) => {
                const champion = dataset()!.championData[s.championKey];
                return (
                    champion.name
                        .replaceAll(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "")
                        .toLowerCase()
                        .includes(str) ||
                    championName(champion, config)
                        .replaceAll(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "")
                        .toLowerCase()
                        .includes(str)
                );
            });
        }

        if (roleFilter() !== undefined) {
            filtered = filtered.filter((s) => s.role === roleFilter());
        }

        if (favouriteFilter()) {
            filtered = filtered.filter((s) =>
                isFavourite(s.championKey, s.role),
            );
        }

        if (config.showFavouritesAtTop) {
            filtered = [...filtered].sort((a, b) => {
                const aFav = isFavourite(a.championKey, a.role);
                const bFav = isFavourite(b.championKey, b.role);
                if (aFav && !bFav) {
                    return -1;
                } else if (!aFav && bFav) {
                    return 1;
                } else {
                    return 0;
                }
            });
        }

        if (config.banPlacement === "hidden") {
            filtered = filtered.filter((s) => !bans.includes(s.championKey));
        } else if (config.banPlacement === "bottom") {
            filtered = [...filtered].sort((a, b) => {
                const aBanned = bans.includes(a.championKey);
                const bBanned = bans.includes(b.championKey);
                if (aBanned && !bBanned) {
                    return 1;
                } else if (!aBanned && bBanned) {
                    return -1;
                } else {
                    return 0;
                }
            });
        }

        if (config.unownedPlacement === "hidden") {
            filtered = filtered.filter((s) => ownsChampion(s.championKey));
        } else if (config.unownedPlacement === "bottom") {
            filtered = [...filtered].sort((a, b) => {
                const aUnowned = !ownsChampion(a.championKey);
                const bUnowned = !ownsChampion(b.championKey);
                if (aUnowned && !bUnowned) {
                    return 1;
                } else if (!aUnowned && bUnowned) {
                    return -1;
                } else {
                    return 0;
                }
            });
        }

        return filtered;
    });

    return { allySuggestions, opponentSuggestions, filteredSuggestions };
}

export const DraftSuggestionsContext =
    createContext<ReturnType<typeof createDraftSuggestionsContext>>();

export function DraftSuggestionsProvider(props: { children: JSXElement }) {
    return (
        <DraftSuggestionsContext.Provider
            value={createDraftSuggestionsContext()}
        >
            {props.children}
        </DraftSuggestionsContext.Provider>
    );
}

export function useDraftSuggestions() {
    const useCtx = useContext(DraftSuggestionsContext);
    if (!useCtx) throw new Error("No DraftSuggestionsContext found");

    return useCtx;
}
