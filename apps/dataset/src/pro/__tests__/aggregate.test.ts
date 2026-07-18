import { describe, expect, it } from "bun:test";
import { aggregateProGames } from "../aggregate";
import type { ProMatch, ProPick } from "../types";

// Minimal helper to build a match with 2 picks per side (top=0, jng=1),
// so matchup/synergy assertions stay small and exact.
function pick(championKey: string, role: 0 | 1 | 2 | 3 | 4): ProPick {
    return { championKey, role };
}

function match(
    gameId: string,
    winner: "blue" | "red",
    blue: ProPick[],
    red: ProPick[],
): ProMatch {
    return {
        gameId,
        date: "2024-01-01",
        patch: "14.1",
        league: "TEST",
        bluePicks: blue,
        redPicks: red,
        blueBans: [],
        redBans: [],
        winner,
        orderKnown: true,
    };
}

// Blue = champions "1"(top) & "2"(jng); Red = "3"(top) & "4"(jng).
const A = match("A", "blue", [pick("1", 0), pick("2", 1)], [pick("3", 0), pick("4", 1)]);
const B = match("B", "red", [pick("1", 0), pick("2", 1)], [pick("3", 0), pick("4", 1)]);

describe("aggregateProGames — base", () => {
    it("counts games and wins per champion-role across both teams", () => {
        const agg = aggregateProGames([A, B]);
        // champion 1 (blue top): won A, lost B
        expect(agg.base["1"][0]).toEqual({ games: 2, wins: 1 });
        // champion 3 (red top): lost A, won B
        expect(agg.base["3"][0]).toEqual({ games: 2, wins: 1 });
        // champion 4 (red jng)
        expect(agg.base["4"][1]).toEqual({ games: 2, wins: 1 });
    });

    it("counts a single game correctly", () => {
        const agg = aggregateProGames([A]);
        expect(agg.base["1"][0]).toEqual({ games: 1, wins: 1 }); // blue won
        expect(agg.base["3"][0]).toEqual({ games: 1, wins: 0 }); // red lost
    });
});

describe("aggregateProGames — matchup", () => {
    it("records ally-vs-enemy from the ally perspective, both directions", () => {
        const agg = aggregateProGames([A, B]);
        // 1(top) vs 3(top): blue perspective — won A, lost B
        expect(agg.matchup["1"][0][0]["3"]).toEqual({ games: 2, wins: 1 });
        // 3(top) vs 1(top): red perspective — lost A, won B
        expect(agg.matchup["3"][0][0]["1"]).toEqual({ games: 2, wins: 1 });
        // cross-role: 1(top) vs 4(jng)
        expect(agg.matchup["1"][0][1]["4"]).toEqual({ games: 2, wins: 1 });
    });
});

describe("aggregateProGames — synergy", () => {
    it("records within-team pairs from both champions' perspectives", () => {
        const agg = aggregateProGames([A, B]);
        // blue duo 1(top)+2(jng): won A, lost B
        expect(agg.synergy["1"][0][1]["2"]).toEqual({ games: 2, wins: 1 });
        expect(agg.synergy["2"][1][0]["1"]).toEqual({ games: 2, wins: 1 });
        // red duo 3(top)+4(jng): lost A, won B
        expect(agg.synergy["3"][0][1]["4"]).toEqual({ games: 2, wins: 1 });
    });

    it("does not create cross-team synergies", () => {
        const agg = aggregateProGames([A]);
        // champion 1 (blue) has no synergy entry with champion 3 (red)
        expect(agg.synergy["1"][0][0]?.["3"]).toBeUndefined();
    });
});

describe("aggregateProGames — filter & 5v5 totals", () => {
    it("honours a match filter", () => {
        const agg = aggregateProGames([A, B], {
            filter: (m) => m.winner === "blue",
        });
        expect(agg.base["1"][0]).toEqual({ games: 1, wins: 1 }); // only A counted
    });

    it("produces sane totals for a full 5v5 game", () => {
        const blue: ProPick[] = [
            pick("10", 0), pick("11", 1), pick("12", 2), pick("13", 3), pick("14", 4),
        ];
        const red: ProPick[] = [
            pick("20", 0), pick("21", 1), pick("22", 2), pick("23", 3), pick("24", 4),
        ];
        const agg = aggregateProGames([match("G", "blue", blue, red)]);
        // 10 base cells, each 1 game
        const baseGames = Object.values(agg.base).flatMap((r) =>
            Object.values(r).map((c) => c.games),
        );
        expect(baseGames).toHaveLength(10);
        expect(baseGames.every((g) => g === 1)).toBe(true);
        // each champion faces 5 enemies -> 5 matchup cells; 10 champions -> 50 cells
        const matchupCells = Object.values(agg.matchup).flatMap((byAlly) =>
            Object.values(byAlly).flatMap((byEnemyRole) =>
                Object.values(byEnemyRole).flatMap((byChamp) =>
                    Object.values(byChamp),
                ),
            ),
        );
        expect(matchupCells).toHaveLength(50);
    });
});
