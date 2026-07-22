import { Icon } from "solid-heroicons";
import { questionMarkCircle } from "solid-heroicons/solid-mini";
import { Show } from "solid-js";
import { ButtonGroup, ButtonGroupOption } from "../common/ButtonGroup";
import { Switch } from "../common/Switch";
import {
    RiskLevel,
    displayNameByRiskLevel,
} from "@draftgap/core/src/risk/risk-level";
import { useUser } from "../../contexts/UserContext";
import { useMedia } from "../../hooks/useMedia";
import {
    DataSource,
    DraftTablePlacement,
    StatsSite,
} from "@draftgap/core/src/models/user/Config";
import {
    TIERS,
    DEFAULT_TIER,
    displayNameByTier,
    type Tier,
} from "@draftgap/core/src/models/Tier";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../common/Dialog";
import { FAQDialog } from "./FAQDialog";

export default function SettingsDialog() {
    const { isDesktop } = useMedia();
    const { config, setConfig } = useUser();

    const riskLevelOptions: ButtonGroupOption<RiskLevel>[] = RiskLevel.map(
        (level) => ({
            value: level,
            label: displayNameByRiskLevel[level],
        }),
    );

    const draftTablePlacementOptions = [
        {
            value: DraftTablePlacement.Bottom,
            label: "Bottom",
        },
        {
            value: DraftTablePlacement.InPlace,
            label: "In Place",
        },
        {
            value: DraftTablePlacement.Hidden,
            label: "Hidden",
        },
    ];

    const statsSiteOptions = [
        {
            value: "lolalytics",
            label: "lolalytics",
        },
        {
            value: "u.gg",
            label: "u.gg",
        },
        {
            value: "op.gg",
            label: "op.gg",
        },
    ] as const;

    const dataSourceOptions: ButtonGroupOption<DataSource>[] = [
        { value: "soloq", label: "Soloqueue" },
        { value: "pro", label: "Pro" },
    ];

    const tierOptions: ButtonGroupOption<Tier>[] = TIERS.map((t) => ({
        value: t,
        label: displayNameByTier[t],
    }));

    return (
        <DialogContent class="max-w-md">
            <DialogHeader>
                <DialogTitle>SETTINGS</DialogTitle>
            </DialogHeader>
            <div class="space-y-5 py-1">
                {/* DATA SECTION */}
                <div>
                    <h3 class="font-title text-xs tracking-widest text-secondary uppercase font-bold border-b border-neutral-800/80 pb-1.5 mb-3">
                        Data Configuration
                    </h3>
                    <div class="flex flex-col gap-1.5">
                        <span class="font-title text-xs uppercase font-bold text-neutral-200 tracking-wider">
                            Data source
                        </span>
                        <ButtonGroup
                            options={dataSourceOptions}
                            selected={config.dataSource ?? "soloq"}
                            size="sm"
                            onChange={(value: DataSource) =>
                                setConfig({ dataSource: value })
                            }
                        />
                        <span class="text-xs text-neutral-400 leading-relaxed">
                            Pro analyses locally-built professional match data.
                            Soloqueue is the default live rank data.
                        </span>
                    </div>
                    <Show when={(config.dataSource ?? "soloq") === "soloq"}>
                        <div class="flex flex-col gap-1.5 mt-3">
                            <span class="font-title text-xs uppercase font-bold text-neutral-200 tracking-wider">
                                Level of play
                            </span>
                            <ButtonGroup
                                options={tierOptions}
                                selected={config.tier ?? DEFAULT_TIER}
                                size="sm"
                                onChange={(value: Tier) =>
                                    setConfig({ tier: value })
                                }
                            />
                            <span class="text-xs text-neutral-400 leading-relaxed">
                                Rank bracket for soloqueue data. Higher tiers better
                                reflect high-elo play.
                            </span>
                        </div>
                    </Show>
                </div>

                {/* DRAFT SECTION */}
                <div>
                    <h3 class="font-title text-xs tracking-widest text-secondary uppercase font-bold border-b border-neutral-800/80 pb-1.5 mb-3">
                        Draft Algorithm
                    </h3>
                    <div class="flex items-center justify-between gap-4 py-1">
                        <span class="font-title text-xs uppercase font-bold text-neutral-200 tracking-wider">
                            Ignore champion winrates
                        </span>
                        <Switch
                            checked={config.ignoreChampionWinrates}
                            onChange={() =>
                                setConfig({
                                    ignoreChampionWinrates:
                                        !config.ignoreChampionWinrates,
                                })
                            }
                        />
                    </div>
                    <div class="flex flex-col gap-1.5 mt-3">
                        <div class="flex items-center gap-1.5">
                            <span class="font-title text-xs uppercase font-bold text-neutral-200 tracking-wider">
                                Risk level
                            </span>
                            <Dialog>
                                <DialogTrigger class="text-neutral-500 hover:text-secondary transition-colors">
                                    <Icon
                                        path={questionMarkCircle}
                                        class="w-4 h-4"
                                    />
                                </DialogTrigger>
                                <FAQDialog />
                            </Dialog>
                        </div>
                        <ButtonGroup
                            options={riskLevelOptions}
                            selected={config.riskLevel}
                            size="sm"
                            onChange={(value: RiskLevel) =>
                                setConfig({
                                    riskLevel: value,
                                })
                            }
                        />
                    </div>
                </div>

                {/* UI SECTION */}
                <div>
                    <h3 class="font-title text-xs tracking-widest text-secondary uppercase font-bold border-b border-neutral-800/80 pb-1.5 mb-3">
                        User Interface
                    </h3>
                    <div class="flex items-center justify-between gap-4 py-1">
                        <span class="font-title text-xs uppercase font-bold text-neutral-200 tracking-wider">
                            Place favourites at top of suggestions
                        </span>
                        <Switch
                            checked={config.showFavouritesAtTop}
                            onChange={() =>
                                setConfig({
                                    showFavouritesAtTop:
                                        !config.showFavouritesAtTop,
                                })
                            }
                        />
                    </div>

                    <Show when={isDesktop}>
                        <div class="flex flex-col gap-1.5 mt-3">
                            <span class="font-title text-xs uppercase font-bold text-neutral-200 tracking-wider">
                                Banned champions placement
                            </span>
                            <ButtonGroup
                                options={draftTablePlacementOptions}
                                selected={config.banPlacement}
                                size="sm"
                                onChange={(v) =>
                                    setConfig({
                                        banPlacement: v,
                                    })
                                }
                            />
                        </div>
                        <div class="flex flex-col gap-1.5 mt-3">
                            <span class="font-title text-xs uppercase font-bold text-neutral-200 tracking-wider">
                                Unowned champions placement
                            </span>
                            <ButtonGroup
                                options={[
                                    {
                                        value: DraftTablePlacement.Bottom,
                                        label: "Bottom",
                                    },
                                    {
                                        value: DraftTablePlacement.InPlace,
                                        label: "In Place",
                                    },
                                    {
                                        value: DraftTablePlacement.Hidden,
                                        label: "Hidden",
                                    },
                                ]}
                                size="sm"
                                selected={config.unownedPlacement}
                                onChange={(v) =>
                                    setConfig({
                                        unownedPlacement: v,
                                    })
                                }
                            />
                        </div>
                    </Show>

                    <div class="flex items-center justify-between gap-4 py-1 mt-3">
                        <span class="font-title text-xs uppercase font-bold text-neutral-200 tracking-wider">
                            Show advanced winrates
                        </span>
                        <Switch
                            checked={config.showAdvancedWinrates}
                            onChange={() =>
                                setConfig({
                                    showAdvancedWinrates:
                                        !config.showAdvancedWinrates,
                                })
                            }
                        />
                    </div>
                </div>

                {/* LEAGUE CLIENT INTEGRATION SECTION */}
                <Show when={isDesktop}>
                    <div>
                        <h3 class="font-title text-xs tracking-widest text-secondary uppercase font-bold border-b border-neutral-800/80 pb-1.5 mb-3">
                            League Client Integration
                        </h3>
                        <div class="flex items-center justify-between gap-4 py-1">
                            <span class="font-title text-xs uppercase font-bold text-neutral-200 tracking-wider">
                                Disable client auto-sync
                            </span>
                            <Switch
                                checked={config.disableLeagueClientIntegration}
                                onChange={() =>
                                    setConfig({
                                        disableLeagueClientIntegration:
                                            !config.disableLeagueClientIntegration,
                                    })
                                }
                            />
                        </div>
                    </div>
                </Show>

                {/* MISC SECTION */}
                <div>
                    <h3 class="font-title text-xs tracking-widest text-secondary uppercase font-bold border-b border-neutral-800/80 pb-1.5 mb-3">
                        Miscellaneous
                    </h3>
                    <div class="flex flex-col gap-1.5">
                        <span class="font-title text-xs uppercase font-bold text-neutral-200 tracking-wider">
                            Favourite builds site
                        </span>
                        <ButtonGroup
                            options={statsSiteOptions}
                            selected={config.defaultStatsSite}
                            size="sm"
                            onChange={(value: StatsSite) =>
                                setConfig({
                                    defaultStatsSite: value,
                                })
                            }
                        />
                    </div>
                </div>
            </div>
        </DialogContent>
    );
}
