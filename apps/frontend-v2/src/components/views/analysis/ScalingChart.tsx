import { Component, createMemo, createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { ratingToWinrate } from "@draftgap/core/src/rating/ratings";
import { useExtraDraftAnalysis } from "../../../contexts/ExtraDraftAnalysisContext";
import { useDataset } from "../../../contexts/DatasetContext";
import { formatRating } from "../../../utils/rating";
import { championName } from "../../../utils/i18n";
import { useUser } from "../../../contexts/UserContext";
import { Role } from "@draftgap/core/src/models/Role";
import { ChampionIcon } from "../../icons/ChampionIcon";
import { RoleIcon } from "../../icons/roles/RoleIcon";
import { cn } from "../../../utils/style";

type ViewMode = "teams" | "ally" | "opponent" | "all";

const TIME_LABELS = ["0-20m", "20-25m", "25-30m", "30-35m", "35+m"];
const FULL_TIME_LABELS = ["0–20 mins", "20–25 mins", "25–30 mins", "30–35 mins", "35+ mins"];

// Role Color Palette (Each role has a distinct color; Ally uses Light shade, Enemy uses Dark/Deeper shade)
const ALLY_ROLE_COLORS: Record<Role, { stroke: string; bg: string; text: string; name: string }> = {
    [Role.Top]: { stroke: "#f59e0b", bg: "bg-amber-500/20", text: "text-amber-400", name: "Top" },       // Light Amber / Gold
    [Role.Jungle]: { stroke: "#10b981", bg: "bg-emerald-500/20", text: "text-emerald-400", name: "Jungle" },  // Light Emerald / Mint
    [Role.Middle]: { stroke: "#06b6d4", bg: "bg-cyan-500/20", text: "text-cyan-400", name: "Mid" },     // Light Cyan / Sky
    [Role.Bottom]: { stroke: "#a855f7", bg: "bg-purple-500/20", text: "text-purple-400", name: "Bot" }, // Light Violet / Lavender
    [Role.Support]: { stroke: "#ec4899", bg: "bg-pink-500/20", text: "text-pink-400", name: "Sup" },   // Light Pink / Rose
};

const OPPONENT_ROLE_COLORS: Record<Role, { stroke: string; bg: string; text: string; name: string }> = {
    [Role.Top]: { stroke: "#ea580c", bg: "bg-orange-700/20", text: "text-orange-500", name: "Top" },    // Dark Orange / Rust
    [Role.Jungle]: { stroke: "#047857", bg: "bg-emerald-800/20", text: "text-emerald-600", name: "Jungle" }, // Dark Forest Green
    [Role.Middle]: { stroke: "#1d4ed8", bg: "bg-blue-800/20", text: "text-blue-500", name: "Mid" },       // Dark Royal Blue
    [Role.Bottom]: { stroke: "#6b21a8", bg: "bg-purple-900/20", text: "text-purple-600", name: "Bot" }, // Dark Deep Purple
    [Role.Support]: { stroke: "#be123c", bg: "bg-rose-900/20", text: "text-rose-600", name: "Sup" },   // Dark Crimson / Maroon
};

function generateSmoothPath(points: { x: number; y: number }[]): string {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];
        const cp1x = curr.x + (next.x - curr.x) / 2;
        const cp1y = curr.y;
        const cp2x = curr.x + (next.x - curr.x) / 2;
        const cp2y = next.y;
        path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
    }
    return path;
}

function generateAreaPath(points: { x: number; y: number }[], bottomY: number): string {
    if (points.length === 0) return "";
    const linePath = generateSmoothPath(points);
    const firstX = points[0].x.toFixed(1);
    const lastX = points[points.length - 1].x.toFixed(1);
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
}

export const ScalingChart: Component = () => {
    const { allyDraftExtraAnalysis, opponentDraftExtraAnalysis } =
        useExtraDraftAnalysis();
    const { dataset } = useDataset();
    const { config } = useUser();

    // View, Hover & Pin States
    const [activeMode, setActiveMode] = createSignal<ViewMode>("teams");
    const [hoveredTeam, setHoveredTeam] = createSignal<"ally" | "opponent" | null>(null);
    const [hoveredBucketIndex, setHoveredBucketIndex] = createSignal<number | null>(null);
    const [pinnedBucketIndex, setPinnedBucketIndex] = createSignal<number | null>(null);
    const [hoveredChampKey, setHoveredChampKey] = createSignal<string | null>(null);

    // Fine-grained Solid.js Store for instant 0ms pinned state reactivity
    const [pinnedChamps, setPinnedChamps] = createStore<Record<string, boolean>>({});

    const allyRatings = () => allyDraftExtraAnalysis()?.ratingByTime ?? [];
    const opponentRatings = () => opponentDraftExtraAnalysis()?.ratingByTime ?? [];

    const isLoaded = () =>
        allyRatings().length === 5 && opponentRatings().length === 5 && dataset() !== undefined;

    // Active displayed bucket (hovered overrides pinned, or fallback to pinned)
    const activeBucketIndex = () => hoveredBucketIndex() ?? pinnedBucketIndex();

    function toggleChampionKey(key: string) {
        setPinnedChamps(key, (prev) => !prev);
    }

    function clearSelectedChampions() {
        setPinnedChamps({});
    }

    const pinnedCount = createMemo(() =>
        Object.values(pinnedChamps).filter(Boolean).length,
    );

    // Derived Winrate Series (0-100%)
    const allyTeamSeries = createMemo(() =>
        allyRatings().map((r) => Math.round(ratingToWinrate(r.totalRating) * 1000) / 10),
    );
    const opponentTeamSeries = createMemo(() =>
        opponentRatings().map((r) => Math.round(ratingToWinrate(r.totalRating) * 1000) / 10),
    );

    // Individual Champion Series
    const allyChampionSeriesMap = createMemo(() => {
        const ratings = allyRatings();
        if (!ratings.length) return new Map<string, { role: Role; values: number[] }>();

        const map = new Map<string, { role: Role; values: number[] }>();
        ratings[0]?.championResults.forEach((champRes) => {
            map.set(champRes.championKey, { role: champRes.role, values: [] });
        });

        ratings.forEach((bucket) => {
            bucket.championResults.forEach((champRes) => {
                const entry = map.get(champRes.championKey);
                if (entry) {
                    const winratePct = Math.round(ratingToWinrate(champRes.rating) * 1000) / 10;
                    entry.values.push(winratePct);
                }
            });
        });

        return map;
    });

    const opponentChampionSeriesMap = createMemo(() => {
        const ratings = opponentRatings();
        if (!ratings.length) return new Map<string, { role: Role; values: number[] }>();

        const map = new Map<string, { role: Role; values: number[] }>();
        ratings[0]?.championResults.forEach((champRes) => {
            map.set(champRes.championKey, { role: champRes.role, values: [] });
        });

        ratings.forEach((bucket) => {
            bucket.championResults.forEach((champRes) => {
                const entry = map.get(champRes.championKey);
                if (entry) {
                    const winratePct = Math.round(ratingToWinrate(champRes.rating) * 1000) / 10;
                    entry.values.push(winratePct);
                }
            });
        });

        return map;
    });

    // Determine which champion lines to show
    const showAllyChamps = () =>
        activeMode() === "ally" || activeMode() === "all" || hoveredTeam() === "ally";
    const showOpponentChamps = () =>
        activeMode() === "opponent" || activeMode() === "all" || hoveredTeam() === "opponent";

    // Stable Y-Scale Domain (Includes all series so pinning/unpinning never causes jumpiness)
    const yDomain = createMemo(() => {
        const allValues = [
            ...allyTeamSeries(),
            ...opponentTeamSeries(),
        ];
        allyChampionSeriesMap().forEach((c) => allValues.push(...c.values));
        opponentChampionSeriesMap().forEach((c) => allValues.push(...c.values));

        const maxDelta = Math.max(3.5, ...allValues.map((v) => Math.abs(v - 50)));
        return {
            min: Math.floor(50 - maxDelta - 1),
            max: Math.ceil(50 + maxDelta + 1),
        };
    });

    // SVG Dimensions & Coordinates
    const svgWidth = 700;
    const svgHeight = 220;
    const padL = 40;
    const padR = 20;
    const padT = 20;
    const padB = 30;

    const chartW = svgWidth - padL - padR;
    const chartH = svgHeight - padT - padB;

    const getX = (i: number) => padL + i * (chartW / 4);
    const getY = (val: number) => {
        const { min, max } = yDomain();
        const pct = (val - min) / (max - min);
        return padT + chartH * (1 - Math.max(0, Math.min(1, pct)));
    };

    const yBaseline = createMemo(() => getY(50.0));

    // Coordinates for Team Lines
    const allyTeamPoints = createMemo(() =>
        allyTeamSeries().map((v, i) => ({ x: getX(i), y: getY(v), value: v })),
    );
    const opponentTeamPoints = createMemo(() =>
        opponentTeamSeries().map((v, i) => ({ x: getX(i), y: getY(v), value: v })),
    );

    const allyPath = createMemo(() => generateSmoothPath(allyTeamPoints()));
    const allyAreaPath = createMemo(() => generateAreaPath(allyTeamPoints(), yBaseline()));

    const opponentPath = createMemo(() => generateSmoothPath(opponentTeamPoints()));
    const opponentAreaPath = createMemo(() => generateAreaPath(opponentTeamPoints(), yBaseline()));

    // Precomputed champion line geometry (path string + points). Depends only on
    // the series maps and the y-domain, so hover/pin state never regenerates paths.
    type ChampionGeometry = {
        key: string;
        role: Role;
        path: string;
        points: { x: number; y: number }[];
    };
    const buildChampionGeometry = (
        series: Map<string, { role: Role; values: number[] }>,
    ): ChampionGeometry[] => {
        const out: ChampionGeometry[] = [];
        series.forEach((champData, key) => {
            const points = champData.values.map((v, i) => ({
                x: getX(i),
                y: getY(v),
            }));
            out.push({ key, role: champData.role, path: generateSmoothPath(points), points });
        });
        return out;
    };
    const allyChampionGeometry = createMemo(() =>
        buildChampionGeometry(allyChampionSeriesMap()),
    );
    const opponentChampionGeometry = createMemo(() =>
        buildChampionGeometry(opponentChampionSeriesMap()),
    );

    const getChampName = (key: string) => {
        const ds = dataset();
        if (!ds || !ds.championData[key]) return key;
        return championName(ds.championData[key], config);
    };

    return (
        <div class="space-y-4 w-full">
            {/* Top Toolbar: Perspective & Breakdown Modes */}
            <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80 w-full">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[10px] font-title font-bold uppercase tracking-wider text-neutral-500 mr-1">
                        Breakdown Mode
                    </span>
                    <button
                        onClick={() => setActiveMode("teams")}
                        class={cn(
                            "px-2.5 py-1 rounded text-[10px] font-title font-bold uppercase tracking-wide transition select-none cursor-pointer",
                            activeMode() === "teams"
                                ? "bg-neutral-800 text-neutral-100 border border-neutral-700 shadow"
                                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50",
                        )}
                    >
                        Teams Only
                    </button>
                    <button
                        onClick={() => setActiveMode("ally")}
                        onMouseEnter={() => setHoveredTeam("ally")}
                        onMouseLeave={() => setHoveredTeam(null)}
                        class={cn(
                            "px-2.5 py-1 rounded text-[10px] font-title font-bold uppercase tracking-wide transition select-none cursor-pointer flex items-center gap-1",
                            activeMode() === "ally"
                                ? "bg-ally/20 text-ally border border-ally/40 shadow"
                                : "text-neutral-400 hover:text-ally hover:bg-ally/10",
                        )}
                    >
                        <span class="w-1.5 h-1.5 rounded-full bg-ally" />
                        Ally Champs
                    </button>
                    <button
                        onClick={() => setActiveMode("opponent")}
                        onMouseEnter={() => setHoveredTeam("opponent")}
                        onMouseLeave={() => setHoveredTeam(null)}
                        class={cn(
                            "px-2.5 py-1 rounded text-[10px] font-title font-bold uppercase tracking-wide transition select-none cursor-pointer flex items-center gap-1",
                            activeMode() === "opponent"
                                ? "bg-opponent/20 text-opponent border border-opponent/40 shadow"
                                : "text-neutral-400 hover:text-opponent hover:bg-opponent/10",
                        )}
                    >
                        <span class="w-1.5 h-1.5 rounded-full bg-opponent" />
                        Enemy Champs
                    </button>
                    <button
                        onClick={() => setActiveMode("all")}
                        class={cn(
                            "px-2.5 py-1 rounded text-[10px] font-title font-bold uppercase tracking-wide transition select-none cursor-pointer",
                            activeMode() === "all"
                                ? "bg-neutral-800 text-neutral-100 border border-neutral-700 shadow"
                                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50",
                        )}
                    >
                        All Lines
                    </button>

                    <Show when={pinnedCount() > 0}>
                        <button
                            onClick={clearSelectedChampions}
                            class="px-2 py-0.5 rounded text-[9px] font-mono uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition cursor-pointer ml-1"
                        >
                            Clear Pinned Lines ({pinnedCount()})
                        </button>
                    </Show>
                </div>

                <div class="flex items-center gap-3 text-[10px] font-mono text-neutral-400">
                    <span class="flex items-center gap-1.5">
                        <span class="w-2.5 h-0.5 rounded bg-ally inline-block" />
                        Ally Team
                    </span>
                    <span class="flex items-center gap-1.5">
                        <span class="w-2.5 h-0.5 rounded bg-opponent inline-block" />
                        Enemy Team
                    </span>
                </div>
            </div>

            {/* Main Interactive SVG HUD Chart */}
            <Show
                when={isLoaded()}
                fallback={
                    <div class="h-64 rounded-xl bg-neutral-950/40 border border-neutral-800/60 flex items-center justify-center text-neutral-500 font-title text-sm uppercase">
                        Loading Scaling Progression...
                    </div>
                }
            >
                <div class="relative rounded-xl bg-neutral-950/80 border border-neutral-800/80 p-4 shadow-inner overflow-hidden w-full space-y-4">
                    <svg
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        class="w-full h-auto overflow-visible select-none"
                        onMouseLeave={() => setHoveredBucketIndex(null)}
                    >
                        <defs>
                            {/* Gradients */}
                            <linearGradient id="ally-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#6366f1" stop-opacity="0.35" />
                                <stop offset="100%" stop-color="#6366f1" stop-opacity="0.0" />
                            </linearGradient>
                            <linearGradient id="opponent-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#ff4655" stop-opacity="0.35" />
                                <stop offset="100%" stop-color="#ff4655" stop-opacity="0.0" />
                            </linearGradient>
                        </defs>

                        {/* Y-Axis Grid Lines & Labels */}
                        <For each={[yDomain().max, 50.0, yDomain().min]}>
                            {(val) => {
                                const y = getY(val);
                                const isBase = val === 50.0;
                                return (
                                    <g>
                                        <line
                                            x1={padL}
                                            y1={y}
                                            x2={svgWidth - padR}
                                            y2={y}
                                            stroke={isBase ? "#64748b" : "#334155"}
                                            stroke-dasharray={isBase ? "4 4" : "2 2"}
                                            stroke-width={isBase ? "1.5" : "1"}
                                        />
                                        <text
                                            x={padL - 6}
                                            y={y + 3}
                                            fill={isBase ? "#94a3b8" : "#64748b"}
                                            font-size="9"
                                            font-family="monospace"
                                            text-anchor="end"
                                        >
                                            {val.toFixed(0)}%
                                        </text>
                                    </g>
                                );
                            }}
                        </For>

                        {/* Baseline 50% Label */}
                        <text
                            x={svgWidth - padR - 4}
                            y={yBaseline() - 4}
                            fill="#64748b"
                            font-size="8"
                            font-family="monospace"
                            text-anchor="end"
                            class="uppercase font-bold tracking-widest opacity-60"
                        >
                            50% Baseline
                        </text>

                        {/* X-Axis Bucket Gridlines & Labels */}
                        <For each={TIME_LABELS}>
                            {(label, idx) => {
                                const x = getX(idx());
                                const isPinned = pinnedBucketIndex() === idx();
                                const isHovered = activeBucketIndex() === idx();

                                return (
                                    <g
                                        class="cursor-pointer"
                                        onClick={() =>
                                            setPinnedBucketIndex(
                                                isPinned ? null : idx(),
                                            )
                                        }
                                    >
                                        <line
                                            x1={x}
                                            y1={padT}
                                            x2={x}
                                            y2={svgHeight - padB}
                                            stroke={isPinned ? "#00f3ff" : "#1e293b"}
                                            stroke-width={isPinned ? "1.5" : "1"}
                                            stroke-dasharray={isPinned ? "none" : "2 2"}
                                        />
                                        <text
                                            x={x}
                                            y={svgHeight - 10}
                                            fill={
                                                isPinned
                                                    ? "#00f3ff"
                                                    : isHovered
                                                    ? "#38bdf8"
                                                    : "#64748b"
                                            }
                                            font-size="10"
                                            font-family="Oswald, sans-serif"
                                            font-weight="bold"
                                            text-anchor="middle"
                                            class="uppercase tracking-wider transition-colors"
                                        >
                                            {label} {isPinned ? "📌" : ""}
                                        </text>
                                    </g>
                                );
                            }}
                        </For>

                        {/* Team Area Fills */}
                        <path d={allyAreaPath()} fill="url(#ally-gradient)" class="pointer-events-none" />
                        <path d={opponentAreaPath()} fill="url(#opponent-gradient)" class="pointer-events-none" />

                        {/* Champion Scaling Lines - Ally (Light shade for Ally roles) */}
                        <For each={allyChampionGeometry()}>
                            {(champ) => {
                                const isPinned = () => !!pinnedChamps[champ.key];
                                const isHovered = () => hoveredChampKey() === champ.key;
                                const roleColor = ALLY_ROLE_COLORS[champ.role]?.stroke ?? "#f59e0b";

                                return (
                                    <Show when={showAllyChamps() || isPinned() || isHovered()}>
                                        <g
                                            onClick={() => toggleChampionKey(champ.key)}
                                            onMouseEnter={() => setHoveredChampKey(champ.key)}
                                            onMouseLeave={() => setHoveredChampKey(null)}
                                            class="cursor-pointer transition-opacity"
                                            opacity={
                                                isPinned() || isHovered() || hoveredChampKey() === null
                                                    ? 1.0
                                                    : 0.2
                                            }
                                        >
                                            <path
                                                d={champ.path}
                                                fill="none"
                                                stroke={roleColor}
                                                stroke-width={
                                                    isPinned()
                                                        ? "2"
                                                        : isHovered()
                                                        ? "1.75"
                                                        : "1.25"
                                                }
                                                stroke-dasharray={
                                                    isPinned() ? "none" : "3 3"
                                                }
                                            />
                                            <For each={champ.points}>
                                                {(pt) => (
                                                    <circle
                                                        cx={pt.x}
                                                        cy={pt.y}
                                                        r={
                                                            isPinned()
                                                                ? "3.5"
                                                                : isHovered()
                                                                ? "3"
                                                                : "2"
                                                        }
                                                        fill={roleColor}
                                                        stroke={
                                                            isPinned()
                                                                ? "#08090b"
                                                                : "none"
                                                        }
                                                        stroke-width="1"
                                                    />
                                                )}
                                            </For>
                                        </g>
                                    </Show>
                                );
                            }}
                        </For>

                        {/* Champion Scaling Lines - Opponent (Dark shade for Enemy roles) */}
                        <For each={opponentChampionGeometry()}>
                            {(champ) => {
                                const isPinned = () => !!pinnedChamps[champ.key];
                                const isHovered = () => hoveredChampKey() === champ.key;
                                const roleColor = OPPONENT_ROLE_COLORS[champ.role]?.stroke ?? "#ea580c";

                                return (
                                    <Show when={showOpponentChamps() || isPinned() || isHovered()}>
                                        <g
                                            onClick={() => toggleChampionKey(champ.key)}
                                            onMouseEnter={() => setHoveredChampKey(champ.key)}
                                            onMouseLeave={() => setHoveredChampKey(null)}
                                            class="cursor-pointer transition-opacity"
                                            opacity={
                                                isPinned() || isHovered() || hoveredChampKey() === null
                                                    ? 1.0
                                                    : 0.2
                                            }
                                        >
                                            <path
                                                d={champ.path}
                                                fill="none"
                                                stroke={roleColor}
                                                stroke-width={
                                                    isPinned()
                                                        ? "2"
                                                        : isHovered()
                                                        ? "1.75"
                                                        : "1.25"
                                                }
                                                stroke-dasharray={
                                                    isPinned() ? "none" : "2 2"
                                                }
                                            />
                                            <For each={champ.points}>
                                                {(pt) => (
                                                    <circle
                                                        cx={pt.x}
                                                        cy={pt.y}
                                                        r={
                                                            isPinned()
                                                                ? "3.5"
                                                                : isHovered()
                                                                ? "3"
                                                                : "2"
                                                        }
                                                        fill={roleColor}
                                                        stroke={
                                                            isPinned()
                                                                ? "#08090b"
                                                                : "none"
                                                        }
                                                        stroke-width="1"
                                                    />
                                                )}
                                            </For>
                                        </g>
                                    </Show>
                                );
                            }}
                        </For>

                        {/* Team Scaling Main Curves. Cheap "glow" via two stacked
                            translucent halo strokes under the crisp line — no SVG
                            blur filter (which re-rasterized on every hover and lagged). */}
                        <path d={allyPath()} fill="none" stroke="#6366f1" stroke-width="9" stroke-opacity="0.10" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none" />
                        <path d={allyPath()} fill="none" stroke="#6366f1" stroke-width="6" stroke-opacity="0.18" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none" />
                        <path
                            d={allyPath()}
                            fill="none"
                            stroke="#6366f1"
                            stroke-width="3.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="cursor-pointer"
                            onMouseEnter={() => setHoveredTeam("ally")}
                            onMouseLeave={() => setHoveredTeam(null)}
                        />
                        <path d={opponentPath()} fill="none" stroke="#ff4655" stroke-width="9" stroke-opacity="0.10" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none" />
                        <path d={opponentPath()} fill="none" stroke="#ff4655" stroke-width="6" stroke-opacity="0.18" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none" />
                        <path
                            d={opponentPath()}
                            fill="none"
                            stroke="#ff4655"
                            stroke-width="3.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="cursor-pointer"
                            onMouseEnter={() => setHoveredTeam("opponent")}
                            onMouseLeave={() => setHoveredTeam(null)}
                        />

                        {/* Team Data Points & Highlight Rings */}
                        <For each={allyTeamPoints()}>
                            {(pt, idx) => (
                                <g
                                    class="cursor-pointer"
                                    onMouseEnter={() => setHoveredBucketIndex(idx())}
                                    onClick={() =>
                                        setPinnedBucketIndex(
                                            pinnedBucketIndex() === idx() ? null : idx(),
                                        )
                                    }
                                >
                                    <circle cx={pt.x} cy={pt.y} r="4" fill="#6366f1" stroke="#08090b" stroke-width="1.5" />
                                    <Show when={activeBucketIndex() === idx()}>
                                        <circle cx={pt.x} cy={pt.y} r="7" fill="none" stroke="#6366f1" stroke-width="2" opacity="0.9" />
                                        <circle cx={pt.x} cy={pt.y} r="10" fill="none" stroke="#6366f1" stroke-width="1" opacity="0.4" />
                                    </Show>
                                </g>
                            )}
                        </For>

                        <For each={opponentTeamPoints()}>
                            {(pt, idx) => (
                                <g
                                    class="cursor-pointer"
                                    onMouseEnter={() => setHoveredBucketIndex(idx())}
                                    onClick={() =>
                                        setPinnedBucketIndex(
                                            pinnedBucketIndex() === idx() ? null : idx(),
                                        )
                                    }
                                >
                                    <circle cx={pt.x} cy={pt.y} r="4" fill="#ff4655" stroke="#08090b" stroke-width="1.5" />
                                    <Show when={activeBucketIndex() === idx()}>
                                        <circle cx={pt.x} cy={pt.y} r="7" fill="none" stroke="#ff4655" stroke-width="2" opacity="0.9" />
                                        <circle cx={pt.x} cy={pt.y} r="10" fill="none" stroke="#ff4655" stroke-width="1" opacity="0.4" />
                                    </Show>
                                </g>
                            )}
                        </For>

                        {/* Interactive Laser Crosshair Line */}
                        <Show when={activeBucketIndex() !== null}>
                            <line
                                x1={getX(activeBucketIndex()!)}
                                y1={padT}
                                x2={getX(activeBucketIndex()!)}
                                y2={svgHeight - padB}
                                stroke={pinnedBucketIndex() !== null ? "#00f3ff" : "#38bdf8"}
                                stroke-width="1.5"
                                stroke-dasharray="3 3"
                                class="pointer-events-none"
                            />
                        </Show>

                        {/* Transparent Hover/Click Hit Boxes for Each Bucket Column */}
                        <For each={TIME_LABELS}>
                            {(_, idx) => {
                                const w = chartW / 4;
                                const x = padL + idx() * w - w / 2;
                                return (
                                    <rect
                                        x={Math.max(padL, x)}
                                        y={padT}
                                        width={w}
                                        height={chartH}
                                        fill="transparent"
                                        class="cursor-pointer"
                                        onMouseEnter={() => setHoveredBucketIndex(idx())}
                                        onClick={() =>
                                            setPinnedBucketIndex(
                                                pinnedBucketIndex() === idx() ? null : idx(),
                                            )
                                        }
                                    />
                                );
                            }}
                        </For>
                    </svg>

                    {/* Strictly Fixed Height Reserved HUD Panel */}
                    <div class="h-[190px] w-full p-3 rounded-lg bg-neutral-900/90 border border-neutral-800/90 backdrop-blur-sm overflow-hidden flex flex-col justify-center">
                        <Show
                            when={activeBucketIndex() !== null}
                            fallback={
                                <div class="h-full flex flex-col items-center justify-center text-center p-4">
                                    <span class="text-xs font-title font-bold uppercase tracking-wider text-neutral-400 mb-1">
                                        Per-Bucket Champion Scaling Breakdown
                                    </span>
                                    <p class="text-[11px] text-neutral-500 font-body max-w-md">
                                        Hover or <strong class="text-neutral-300">click a time bucket</strong> to pin it. Click any champion row below to plot its scaling curve.
                                    </p>
                                </div>
                            }
                        >
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs h-full">
                                {/* Ally Breakdown */}
                                <div class="space-y-1.5 flex flex-col justify-between">
                                    <div class="flex items-center justify-between border-b border-neutral-800 pb-1">
                                        <span class="font-title font-bold text-ally uppercase tracking-wider flex items-center gap-1">
                                            <span class="w-2 h-2 rounded-full bg-ally" />
                                            Ally Scaling ({FULL_TIME_LABELS[activeBucketIndex()!]})
                                            <Show when={pinnedBucketIndex() === activeBucketIndex()}>
                                                <button
                                                    onClick={() => setPinnedBucketIndex(null)}
                                                    class="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded font-mono uppercase ml-1.5 hover:bg-cyan-500/40 cursor-pointer"
                                                >
                                                    Pinned ✕
                                                </button>
                                            </Show>
                                        </span>
                                        <span class="font-mono font-bold text-neutral-200">
                                            {allyTeamSeries()[activeBucketIndex()!]}%
                                        </span>
                                    </div>

                                    <div class="space-y-1">
                                        <For
                                            each={
                                                allyRatings()[
                                                    activeBucketIndex()!
                                                ]?.championResults ?? []
                                            }
                                        >
                                            {(res) => {
                                                const winratePct =
                                                    Math.round(
                                                        ratingToWinrate(res.rating) *
                                                            1000,
                                                    ) / 10;
                                                const delta = winratePct - 50;
                                                const isPinned = !!pinnedChamps[res.championKey];
                                                const isHovered = () => hoveredChampKey() === res.championKey;
                                                const roleStroke = ALLY_ROLE_COLORS[res.role]?.stroke ?? "#f59e0b";

                                                return (
                                                    <div
                                                        onClick={() => toggleChampionKey(res.championKey)}
                                                        onMouseEnter={() => setHoveredChampKey(res.championKey)}
                                                        onMouseLeave={(e) => {
                                                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                                                setHoveredChampKey(null);
                                                            }
                                                        }}
                                                        style={
                                                            isPinned
                                                                ? {
                                                                      "border-color": roleStroke,
                                                                      "background-color": `${roleStroke}25`,
                                                                  }
                                                                : isHovered()
                                                                ? {
                                                                      "border-color": roleStroke,
                                                                      "background-color": `${roleStroke}12`,
                                                                  }
                                                                : {}
                                                        }
                                                        class={cn(
                                                            "flex items-center justify-between text-[11px] px-2 py-0.5 rounded transition-colors cursor-pointer select-none border",
                                                            isPinned
                                                                ? "shadow-sm"
                                                                : "bg-neutral-950/60 border-neutral-800/40 hover:border-neutral-700",
                                                        )}
                                                    >
                                                        <div class="flex items-center gap-2 pointer-events-none">
                                                            <RoleIcon
                                                                role={res.role}
                                                                class="w-3.5 h-3.5 shrink-0 pointer-events-none"
                                                                style={{ color: roleStroke }}
                                                            />
                                                            <ChampionIcon
                                                                championKey={
                                                                    res.championKey
                                                                }
                                                                size={16}
                                                            />
                                                            <span
                                                                class="font-title font-semibold truncate pointer-events-none"
                                                                style={{
                                                                    color: isPinned || isHovered()
                                                                        ? roleStroke
                                                                        : "#e5e5e5",
                                                                }}
                                                            >
                                                                {getChampName(
                                                                    res.championKey,
                                                                )}
                                                            </span>
                                                            <Show when={isPinned}>
                                                                <span
                                                                    class="text-[8px] text-neutral-950 font-mono px-1 rounded uppercase font-bold pointer-events-none"
                                                                    style={{ "background-color": roleStroke }}
                                                                >
                                                                    Line Pinned
                                                                </span>
                                                            </Show>
                                                        </div>
                                                        <span
                                                            class={cn(
                                                                "font-mono text-[10px] font-bold shrink-0 ml-2 pointer-events-none",
                                                                delta >= 0
                                                                    ? "text-emerald-400"
                                                                    : "text-rose-400",
                                                            )}
                                                        >
                                                            {delta >= 0 ? "+" : ""}
                                                            {delta.toFixed(1)}% ({formatRating(res.rating)})
                                                        </span>
                                                    </div>
                                                );
                                            }}
                                        </For>
                                    </div>
                                </div>

                                {/* Opponent Breakdown */}
                                <div class="space-y-1.5 flex flex-col justify-between">
                                    <div class="flex items-center justify-between border-b border-neutral-800 pb-1">
                                        <span class="font-title font-bold text-opponent uppercase tracking-wider flex items-center gap-1">
                                            <span class="w-2 h-2 rounded-full bg-opponent" />
                                            Enemy Scaling ({FULL_TIME_LABELS[activeBucketIndex()!]})
                                            <Show when={pinnedBucketIndex() === activeBucketIndex()}>
                                                <button
                                                    onClick={() => setPinnedBucketIndex(null)}
                                                    class="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded font-mono uppercase ml-1.5 hover:bg-cyan-500/40 cursor-pointer"
                                                >
                                                    Pinned ✕
                                                </button>
                                            </Show>
                                        </span>
                                        <span class="font-mono font-bold text-neutral-200">
                                            {opponentTeamSeries()[activeBucketIndex()!]}%
                                        </span>
                                    </div>

                                    <div class="space-y-1">
                                        <For
                                            each={
                                                opponentRatings()[
                                                    activeBucketIndex()!
                                                ]?.championResults ?? []
                                            }
                                        >
                                            {(res) => {
                                                const winratePct =
                                                    Math.round(
                                                        ratingToWinrate(res.rating) *
                                                            1000,
                                                    ) / 10;
                                                const delta = winratePct - 50;
                                                const isPinned = !!pinnedChamps[res.championKey];
                                                const isHovered = () => hoveredChampKey() === res.championKey;
                                                const roleStroke = OPPONENT_ROLE_COLORS[res.role]?.stroke ?? "#ea580c";

                                                return (
                                                    <div
                                                        onClick={() => toggleChampionKey(res.championKey)}
                                                        onMouseEnter={() => setHoveredChampKey(res.championKey)}
                                                        onMouseLeave={(e) => {
                                                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                                                setHoveredChampKey(null);
                                                            }
                                                        }}
                                                        style={
                                                            isPinned
                                                                ? {
                                                                      "border-color": roleStroke,
                                                                      "background-color": `${roleStroke}25`,
                                                                  }
                                                                : isHovered()
                                                                ? {
                                                                      "border-color": roleStroke,
                                                                      "background-color": `${roleStroke}12`,
                                                                  }
                                                                : {}
                                                        }
                                                        class={cn(
                                                            "flex items-center justify-between text-[11px] px-2 py-0.5 rounded transition-colors cursor-pointer select-none border",
                                                            isPinned
                                                                ? "shadow-sm"
                                                                : "bg-neutral-950/60 border-neutral-800/40 hover:border-neutral-700",
                                                        )}
                                                    >
                                                        <div class="flex items-center gap-2 pointer-events-none">
                                                            <RoleIcon
                                                                role={res.role}
                                                                class="w-3.5 h-3.5 shrink-0 pointer-events-none"
                                                                style={{ color: roleStroke }}
                                                            />
                                                            <ChampionIcon
                                                                championKey={
                                                                    res.championKey
                                                                }
                                                                size={16}
                                                            />
                                                            <span
                                                                class="font-title font-semibold truncate pointer-events-none"
                                                                style={{
                                                                    color: isPinned || isHovered()
                                                                        ? roleStroke
                                                                        : "#e5e5e5",
                                                                }}
                                                            >
                                                                {getChampName(
                                                                    res.championKey,
                                                                )}
                                                            </span>
                                                            <Show when={isPinned}>
                                                                <span
                                                                    class="text-[8px] text-neutral-950 font-mono px-1 rounded uppercase font-bold pointer-events-none"
                                                                    style={{ "background-color": roleStroke }}
                                                                >
                                                                    Line Pinned
                                                                </span>
                                                            </Show>
                                                        </div>
                                                        <span
                                                            class={cn(
                                                                "font-mono text-[10px] font-bold shrink-0 ml-2 pointer-events-none",
                                                                delta >= 0
                                                                    ? "text-emerald-400"
                                                                    : "text-rose-400",
                                                            )}
                                                        >
                                                            {delta >= 0 ? "+" : ""}
                                                            {delta.toFixed(1)}% ({formatRating(res.rating)})
                                                        </span>
                                                    </div>
                                                );
                                            }}
                                        </For>
                                    </div>
                                </div>
                            </div>
                        </Show>
                    </div>
                </div>
            </Show>
        </div>
    );
};
