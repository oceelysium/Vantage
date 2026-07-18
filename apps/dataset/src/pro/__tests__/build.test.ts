import { describe, expect, it } from "bun:test";
import type { Dataset } from "@draftgap/core/src/models/dataset/Dataset";
import { buildProDataset, computeProMeta } from "../build";
import type { ProAggregate, ProMatch } from "../types";

const wr = (c: { wins: number; games: number }) => c.wins / c.games;

function makeRole(
    games: number,
    wins: number,
    matchup: Record<number, Record<string, { championKey: string; games: number; wins: number }>> = {},
    synergy: Record<number, Record<string, { championKey: string; games: number; wins: number }>> = {},
) {
    return {
        games,
        wins,
        matchup,
        synergy,
        damageProfile: { magic: 0, physical: 0, true: 0 },
        statsByTime: [],
    };
}

function makePrior(): Dataset {
    return {
        version: "5",
        date: "2024-01-01",
        itemData: { 1001: { id: 1001, name: "Boots", gold: 300 } },
        runeData: {},
        runePathData: {},
        statShardData: {},
        summonerSpellData: {},
        championData: {
            "1": {
                id: "C1",
                key: "1",
                name: "One",
                i18n: {},
                statsByRole: {
                    0: makeRole(
                        1000,
                        500, // base 0.5
                        {
                            1: {
                                "2": { championKey: "2", games: 200, wins: 100 }, // 0.5, has pro
                                "9": { championKey: "9", games: 300, wins: 150 }, // 0.5, no pro -> carried
                            },
                        },
                        { 1: { "3": { championKey: "3", games: 100, wins: 50 } } }, // 0.5, has pro
                    ),
                },
            },
            "2": {
                id: "C2",
                key: "2",
                name: "Two",
                i18n: {},
                statsByRole: { 0: makeRole(800, 480) }, // base 0.6, no pro data
            },
        },
    } as unknown as Dataset;
}

const aggregate = {
    base: { "1": { 0: { games: 100, wins: 70 } } }, // pro 0.7
    matchup: { "1": { 0: { 1: { "2": { games: 50, wins: 35 } } } } }, // pro 0.7
    synergy: { "1": { 0: { 1: { "3": { games: 40, wins: 28 } } } } }, // pro 0.7
} as unknown as ProAggregate;

const cfg = { blend: { priorGames: 100, ratingScale: true } } as const;

describe("buildProDataset", () => {
    it("blends base winrate toward the pro estimate", () => {
        const out = buildProDataset(makePrior(), aggregate, cfg);
        const base = out.championData["1"].statsByRole[0];
        expect(base.games).toBe(200); // 100 pro + 100 k
        expect(wr(base)).toBeGreaterThan(0.5);
        expect(wr(base)).toBeLessThan(0.7);
    });

    it("blends an observed matchup and preserves the enemy key + effective games", () => {
        const out = buildProDataset(makePrior(), aggregate, cfg);
        const cell = out.championData["1"].statsByRole[0].matchup[1]["2"];
        expect(cell.championKey).toBe("2");
        expect(cell.games).toBe(150); // 50 pro + 100 k
        expect(wr(cell)).toBeGreaterThan(0.5);
        expect(wr(cell)).toBeLessThan(0.7);
    });

    it("carries through matchups with no pro observation unchanged", () => {
        const out = buildProDataset(makePrior(), aggregate, cfg);
        const cell = out.championData["1"].statsByRole[0].matchup[1]["9"];
        expect(cell).toEqual({ championKey: "9", games: 300, wins: 150 });
    });

    it("blends an observed synergy", () => {
        const out = buildProDataset(makePrior(), aggregate, cfg);
        const cell = out.championData["1"].statsByRole[0].synergy[1]["3"];
        expect(cell.championKey).toBe("3");
        expect(cell.games).toBe(140); // 40 pro + 100 k
        expect(wr(cell)).toBeGreaterThan(0.5);
    });

    it("keeps prior winrate (games = k) for champion-roles with no pro data", () => {
        const out = buildProDataset(makePrior(), aggregate, cfg);
        const base = out.championData["2"].statsByRole[0];
        expect(base.games).toBe(100); // 0 pro + 100 k
        expect(wr(base)).toBeCloseTo(0.6, 4); // prior 480/800
    });

    it("preserves static (non-champion) dataset fields", () => {
        const out = buildProDataset(makePrior(), aggregate, cfg);
        expect((out.itemData as any)[1001].name).toBe("Boots");
    });

    it("does not mutate the input prior", () => {
        const prior = makePrior();
        buildProDataset(prior, aggregate, cfg);
        expect(prior.championData["1"].statsByRole[0].games).toBe(1000);
        expect(prior.championData["1"].statsByRole[0].wins).toBe(500);
    });
});

describe("computeProMeta", () => {
    const m = (patch: string, league: string): ProMatch => ({
        gameId: "g",
        date: "2026-01-01",
        patch,
        league,
        bluePicks: [],
        redPicks: [],
        blueBans: [],
        redBans: [],
        winner: "blue",
        orderKnown: true,
    });

    it("summarises distinct sorted patches/leagues and counts", () => {
        const meta = computeProMeta(
            [m("16.10", "LCK"), m("16.09", "LPL"), m("16.10", "LCK")],
            100,
        );
        expect(meta.matches).toBe(3);
        expect(meta.patches).toEqual(["16.09", "16.10"]);
        expect(meta.leagues).toEqual(["LCK", "LPL"]);
        expect(meta.priorGames).toBe(100);
        expect(typeof meta.builtAt).toBe("string");
    });
});
