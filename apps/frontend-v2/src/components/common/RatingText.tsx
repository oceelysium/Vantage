import { Component, Show } from "solid-js";
import { formatRating, getRatingClass } from "../../utils/rating";
import { Icon } from "solid-heroicons";
import { exclamationTriangle } from "solid-heroicons/solid-mini";
import { tooltip } from "../../directives/tooltip";
import { useUser } from "../../contexts/UserContext";
import { useDataset } from "../../contexts/DatasetContext";
// eslint-disable-next-line
tooltip;

type Props = {
    rating: number;
    games?: number;
};

// Below this many additional games (beyond the pro prior pseudo-count) a pro cell
// is considered thinly sampled.
const PRO_WARN_GAMES = 40;
const SOLOQ_WARN_GAMES = 1000;

export const RatingText: Component<Props> = (props) => {
    const { config } = useUser();
    const { dataset } = useDataset();

    const isPro = () => (config.dataSource ?? "soloq") === "pro";
    const priorGames = () => dataset()?.proMeta?.priorGames ?? 0;

    // In pro mode, blended games = trueProGames + k, so subtract k to recover the
    // real pro sample and warn on that; in soloq mode use the raw threshold.
    const warnBelow = () =>
        isPro() ? priorGames() + PRO_WARN_GAMES : SOLOQ_WARN_GAMES;
    const proGames = () => Math.max(0, Math.round((props.games ?? 0) - priorGames()));

    const tooltipContent = () =>
        isPro()
            ? `Thin pro sample: about ${proGames()} pro games back this number.`
            : "This winrate might not be accurate due to the small sample size of " +
              Math.ceil(props.games!) +
              " games";

    return (
        <span
            class={`relative ${getRatingClass(props.rating)}`}
            style={{
                "font-variant-numeric": "tabular-nums",
            }}
        >
            {formatRating(props.rating)}
            <Show when={props.games !== undefined && props.games < warnBelow()}>
                <div
                    class="absolute -top-1 -right-6"
                    // @ts-ignore
                    use:tooltip={{
                        content: tooltipContent(),
                    }}
                >
                    <Icon
                        path={exclamationTriangle}
                        class="text-yellow-500 w-5 h-5"
                    />
                </div>
            </Show>
        </span>
    );
};
