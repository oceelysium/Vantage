import { Icon } from "solid-heroicons";
import { funnel } from "solid-heroicons/solid";
import { ButtonGroup, ButtonGroupOption } from "../common/ButtonGroup";
import { Popover, PopoverContent, PopoverTrigger } from "../common/Popover";
import { useUser } from "../../contexts/UserContext";
import { buttonVariants } from "../common/Button";
import { cn } from "../../utils/style";

export function FilterMenu() {
    const { config, setConfig } = useUser();

    const isPro = () => (config.dataSource ?? "soloq") === "pro";

    const soloqOptions: ButtonGroupOption<number>[] = [
        500, 1000, 2500, 5000,
    ].map((n) => ({ value: n, label: n.toString() }));

    // Pro samples are tiny compared to soloqueue, so offer a pro-scale threshold.
    const proOptions: ButtonGroupOption<number>[] = [0, 10, 20, 50].map((n) => ({
        value: n,
        label: n.toString(),
    }));

    return (
        <Popover>
            <PopoverTrigger
                class={cn(buttonVariants({ variant: "transparent" }), "px-1")}
            >
                <Icon path={funnel} class="w-6 text-neutral-300" />
            </PopoverTrigger>
            <PopoverContent>
                <span class="text-2xl uppercase block mb-1 leading-none">
                    Filters
                </span>
                <span class="text-lg uppercase block">
                    {isPro()
                        ? "Minimum pro games"
                        : "Minimum game count (7d)"}
                </span>
                <ButtonGroup
                    options={isPro() ? proOptions : soloqOptions}
                    selected={
                        isPro() ? config.proMinGames ?? 20 : config.minGames
                    }
                    onChange={(value: number) =>
                        setConfig(
                            isPro()
                                ? { proMinGames: value }
                                : { minGames: value },
                        )
                    }
                />
            </PopoverContent>
        </Popover>
    );
}
