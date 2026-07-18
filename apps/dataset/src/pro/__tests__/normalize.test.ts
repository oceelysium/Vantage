import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { parseOeRows } from "../oracles-elixir";
import { buildChampionMap } from "../champion-map";
import { normalizeMatches } from "../normalize";
import { MOCK_CHAMPIONS } from "./mock-champions";

const map = buildChampionMap(MOCK_CHAMPIONS);
const fixture = readFileSync(
    join(import.meta.dir, "fixtures/sample-oe.csv"),
    "utf8",
);

function normalizeFixture() {
    return normalizeMatches(parseOeRows(fixture), map);
}

describe("normalizeMatches (fixture)", () => {
    it("produces one match per game and skips nothing", () => {
        const { matches, skip } = normalizeFixture();
        expect(matches.length).toBe(2);
        expect(skip.skipped).toBe(0);
    });

    it("G1: blue wins, pick order taken from pick columns", () => {
        const g1 = normalizeFixture().matches.find((m) => m.gameId === "G1")!;
        expect(g1.winner).toBe("blue");
        expect(g1.orderKnown).toBe(true);
        expect(g1.patch).toBe("14.13");
        expect(g1.league).toBe("LEC");

        // pick order was Ahri, Wukong, Jinx, Lee Sin, Thresh -> keys with roles
        expect(g1.bluePicks).toEqual([
            { championKey: "103", role: 2 }, // Ahri, mid
            { championKey: "62", role: 0 }, // Wukong, top
            { championKey: "222", role: 3 }, // Jinx, bot
            { championKey: "64", role: 1 }, // Lee Sin, jng
            { championKey: "412", role: 4 }, // Thresh, sup
        ]);

        // bans: Vi, Jax, then "None" filtered out
        expect(g1.blueBans).toEqual(["254", "24"]);
        expect(g1.redBans).toEqual(["268"]); // Azir
    });

    it("G1: red side champions + roles resolve (incl. punctuated names)", () => {
        const g1 = normalizeFixture().matches.find((m) => m.gameId === "G1")!;
        // red pick order: Renekton, Syndra, Nunu & Willump, Kai'Sa, Renata Glasc
        expect(g1.redPicks).toEqual([
            { championKey: "58", role: 0 }, // Renekton, top
            { championKey: "134", role: 2 }, // Syndra, mid
            { championKey: "20", role: 1 }, // Nunu & Willump, jng
            { championKey: "145", role: 3 }, // Kai'Sa, bot
            { championKey: "888", role: 4 }, // Renata Glasc, sup
        ]);
    });

    it("G2: red wins, no pick columns -> role-order fallback", () => {
        const g2 = normalizeFixture().matches.find((m) => m.gameId === "G2")!;
        expect(g2.winner).toBe("red");
        expect(g2.orderKnown).toBe(false);
        expect(g2.patch).toBe("14.14"); // normalized from 14.14.1

        // fallback sorts by role: top, jng, mid, bot, sup
        expect(g2.bluePicks.map((p) => p.role)).toEqual([0, 1, 2, 3, 4]);
        expect(g2.bluePicks.map((p) => p.championKey)).toEqual([
            "150", // Gnar
            "254", // Vi
            "268", // Azir
            "81", // Ezreal
            "117", // Lulu
        ]);
        expect(g2.redBans).toEqual(["103"]); // Ahri
        expect(g2.blueBans).toEqual([]); // only "None"
    });
});

// --- inline edge cases ---

const HEADER =
    "gameid,datacompleteness,date,league,patch,side,position,playername,teamname,champion,ban1,ban2,ban3,ban4,ban5,pick1,pick2,pick3,pick4,pick5,result";

function playerRow(
    g: string,
    dc: string,
    side: string,
    pos: string,
    champ: string,
    result: string,
): string {
    return [
        g, dc, "2024-01-01", "LEC", "14.1", side, pos, `${side}_${pos}`,
        `${side}Team`, champ, "", "", "", "", "", "", "", "", "", "", result,
    ].join(",");
}

function fullGame(
    g: string,
    dc: string,
    overrides: { champ?: string } = {},
): string {
    const blue = [
        ["top", "Wukong"], ["jng", "Lee Sin"], ["mid", "Ahri"],
        ["bot", "Jinx"], ["sup", "Thresh"],
    ];
    const red = [
        ["top", "Renekton"], ["jng", "Nunu & Willump"], ["mid", overrides.champ ?? "Syndra"],
        ["bot", "Kai'Sa"], ["sup", "Renata Glasc"],
    ];
    const lines: string[] = [];
    for (const [pos, champ] of blue)
        lines.push(playerRow(g, dc, "Blue", pos, champ, "1"));
    for (const [pos, champ] of red)
        lines.push(playerRow(g, dc, "Red", pos, champ, "0"));
    return lines.join("\n");
}

describe("normalizeMatches (edge cases)", () => {
    it("skips games not marked complete", () => {
        const csv = `${HEADER}\n${fullGame("GP", "partial")}\n`;
        const { matches, skip } = normalizeMatches(parseOeRows(csv), map);
        expect(matches.length).toBe(0);
        expect(skip.reasons.incomplete).toBe(1);
    });

    it("skips games with an unmapped champion", () => {
        const csv = `${HEADER}\n${fullGame("GX", "complete", { champ: "Zaphod" })}\n`;
        const { matches, skip } = normalizeMatches(parseOeRows(csv), map);
        expect(matches.length).toBe(0);
        expect(skip.reasons.unmapped_champion).toBe(1);
    });

    it("skips games without 5 players per side", () => {
        const csv = `${HEADER}\n${playerRow("GS", "complete", "Blue", "top", "Ahri", "1")}\n`;
        const { matches, skip } = normalizeMatches(parseOeRows(csv), map);
        expect(matches.length).toBe(0);
        expect(skip.reasons.wrong_player_count).toBe(1);
    });
});
