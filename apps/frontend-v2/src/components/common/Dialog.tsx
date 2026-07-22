import { Dialog as DialogPrimitives } from "@kobalte/core";
import { ComponentProps, Show } from "solid-js";
import { cn } from "../../utils/style";
import { Icon } from "solid-heroicons";
import { xMark } from "solid-heroicons/solid";

export const Dialog = DialogPrimitives.Root;

export const DialogTrigger = DialogPrimitives.Trigger;

function DialogPortal(props: ComponentProps<typeof DialogPrimitives.Portal>) {
    return (
        <DialogPrimitives.Portal {...props}>
            <div class="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
                {props.children}
            </div>
        </DialogPrimitives.Portal>
    );
}

function DialogOverlay(props: ComponentProps<typeof DialogPrimitives.Overlay>) {
    return (
        <DialogPrimitives.Overlay
            {...props}
            class={cn(
                "fixed inset-0 bg-neutral-950/80 backdrop-blur-sm transition-colors",
                props.class,
            )}
        />
    );
}

export function DialogContent(
    props: ComponentProps<typeof DialogPrimitives.Content> & {
        canClose?: boolean;
    },
) {
    return (
        <DialogPortal>
            <DialogOverlay class="ui-expanded:animate-enter-opacity animate-leave-opacity" />
            <DialogPrimitives.Content
                {...props}
                class={cn(
                    "fixed z-50 grid w-full gap-5 rounded-xl bg-neutral-900/95 border border-neutral-800 p-6 shadow-[0_0_50px_rgba(0,0,0,0.8),0_0_20px_rgba(0,243,255,0.08)] max-w-lg sm:rounded-xl max-h-[calc(100%-4rem)] overflow-y-auto animate-dialog-leave ui-expanded:animate-dialog-enter text-neutral-100 relative",
                    props.class,
                )}
            >
                <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-secondary/80 via-indigo-500/80 to-rose-500/80" />
                {props.children}
                <Show when={props.canClose ?? true}>
                    <DialogPrimitives.CloseButton class="absolute right-4 top-4 p-1.5 rounded-lg bg-neutral-950/60 border border-neutral-800 text-neutral-400 hover:text-secondary hover:border-secondary/40 transition-colors">
                        <Icon path={xMark} class="h-4 w-4" />
                    </DialogPrimitives.CloseButton>
                </Show>
            </DialogPrimitives.Content>
        </DialogPortal>
    );
}

export function DialogHeader(props: ComponentProps<"div">) {
    return (
        <div
            {...props}
            class={cn(
                "flex flex-col space-y-1.5 text-center sm:text-left border-b border-neutral-800/80 pb-3",
                props.class,
            )}
        >
            {props.children}
        </div>
    );
}

export function DialogFooter(props: ComponentProps<"div">) {
    return (
        <div
            {...props}
            class={cn(
                "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
                props.class,
            )}
        >
            {props.children}
        </div>
    );
}

export function DialogTitle(
    props: ComponentProps<typeof DialogPrimitives.Title>,
) {
    return (
        <DialogPrimitives.Title
            {...props}
            class={cn(
                "font-title text-2xl font-bold uppercase tracking-wider text-neutral-100 flex items-center gap-2",
                props.class,
            )}
        >
            {props.children}
        </DialogPrimitives.Title>
    );
}

export function DialogDescription(
    props: ComponentProps<typeof DialogPrimitives.Description>,
) {
    return (
        <DialogPrimitives.Description
            {...props}
            class={cn("text-sm text-neutral-400", props.class)}
        >
            {props.children}
        </DialogPrimitives.Description>
    );
}
