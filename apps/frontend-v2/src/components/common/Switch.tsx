import { ComponentProps } from "solid-js";
import { Switch as SwitchPrimitives } from "@kobalte/core";
import { cn } from "../../utils/style";

export function Switch(props: ComponentProps<typeof SwitchPrimitives.Root>) {
    return (
        <SwitchPrimitives.Root
            {...props}
            class={cn(
                "relative inline-flex h-6 w-11 shrink-0 rounded-full border border-neutral-800 bg-neutral-950 transition-all duration-200 ease-in-out cursor-pointer items-center",
                {
                    "bg-secondary/20 border-secondary shadow-[0_0_10px_rgba(0,243,255,0.25)]": props.checked,
                },
                props.class,
            )}
        >
            <SwitchPrimitives.Input />
            <SwitchPrimitives.Control class="w-full h-full flex items-center">
                <SwitchPrimitives.Thumb
                    aria-hidden="true"
                    class={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-sm transition-all duration-200 ease-in-out",
                        {
                            "translate-x-5.5 bg-secondary shadow-[0_0_8px_rgba(0,243,255,0.6)]": props.checked,
                            "translate-x-0.5 bg-neutral-400": !props.checked,
                        },
                    )}
                />
            </SwitchPrimitives.Control>
        </SwitchPrimitives.Root>
    );
}
