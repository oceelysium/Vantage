import { Role } from "@draftgap/core/src/models/Role";

/**
 * Oracle's Elixir position strings -> DraftGap Role enum (0..4).
 * OE uses top/jng/mid/bot/sup; a few synonyms are accepted defensively.
 */
export const OE_POSITION_TO_ROLE: Record<string, Role> = {
    top: Role.Top,
    jng: Role.Jungle,
    jungle: Role.Jungle,
    mid: Role.Middle,
    middle: Role.Middle,
    bot: Role.Bottom,
    adc: Role.Bottom,
    bottom: Role.Bottom,
    sup: Role.Support,
    support: Role.Support,
};

/** Map an OE position string to a Role, or null if it is not a lane position. */
export function oePositionToRole(position: string): Role | null {
    const key = position.trim().toLowerCase();
    return key in OE_POSITION_TO_ROLE ? OE_POSITION_TO_ROLE[key] : null;
}
