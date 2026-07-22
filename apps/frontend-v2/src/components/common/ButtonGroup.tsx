import { For, JSX, mergeProps, splitProps } from "solid-js";
import { cn } from "../../utils/style";

export type ButtonGroupOption<T> = {
    label: JSX.Element;
    value: T;
};

interface Props<T> {
    options: readonly ButtonGroupOption<T>[];
    selected: T;
    onChange: (value: T) => void;
    size?: "sm" | "md";
}

export function ButtonGroup<T>(
    _props: Props<T> & Omit<JSX.HTMLAttributes<HTMLDivElement>, "onChange">,
) {
    const mergedProps = mergeProps({ size: "md" }, _props);
    const [props, externalProps] = splitProps(mergedProps, [
        "options",
        "selected",
        "onChange",
        "size",
    ]);
    return (
        <div
            {...externalProps}
            class={cn(
                "isolate inline-flex rounded-md shadow-xs ",
                externalProps.class,
            )}
        >
            <For each={props.options}>
                {(option, i) => (
                    <button
                        type="button"
                        class={cn(
                            "uppercase leading-4 relative inline-flex items-center border text-xs tracking-wider font-title font-bold px-3 py-2.5 bg-neutral-950/80 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 focus:z-10 transition-all duration-150 cursor-pointer",
                            {
                                "rounded-r-md":
                                    i() === props.options.length - 1,
                                "rounded-l-md": i() === 0,
                                "-ml-px": i() !== 0,
                                "text-neutral-950 bg-secondary border-secondary shadow-[0_0_10px_rgba(0,243,255,0.3)] hover:text-neutral-950 hover:bg-secondary z-10":
                                    props.selected === option.value,
                                "py-1.5 px-2.5 text-[11px]": props.size === "sm",
                            },
                        )}
                        onClick={() => props.onChange(option.value)}
                    >
                        {option.label}
                    </button>
                )}
            </For>
        </div>
    );
}
