import { describe, expect, it } from "bun:test";
import type { Dataset } from "@draftgap/core/src/models/dataset/Dataset";
import {
    blendCell,
    clampWinrate,
    priorBaseWinrate,
    priorMatchupWinrate,
    priorSynergyWinrate,
} from "../blend";

const wr = (c: { wins: number; games: number }) => c.wins / c.games;

describe("blendCell", () => {
    it("k = 0 returns the pure pro estimate", () => {
        const out = blendCell({ wins: 6, games: 10 }, 0.5, {
            priorGames: 0,
            ratingScale: true,
        });
        expect(out).toEqual({ wins: 6, games: 10 });
    });

    it("0 pro games collapses to the prior (rating scale)", () => {
        const out = blendCell({ wins: 0, games: 0 }, 0.55, {
            priorGames: 100,
            ratingScale: true,
        });
        expect(out.games).toBe(100);
        expect(wr(out)).toBeCloseTo(0.55, 6);
    });

    it("0 pro games collapses to the prior (Beta-Binomial)", () => {
        const out = blendCell({ wins: 0, games: 0 }, 0.55, {
            priorGames: 100,
            ratingScale: false,
        });
        expect(out.games).toBe(100);
        expect(out.wins).toBeCloseTo(55, 6); // 100 * 0.55, modulo float error
    });

    it("Beta-Binomial adds k pseudo-games to the pro sample", () => {
        const out = blendCell({ wins: 6, games: 10 }, 0.5, {
            priorGames: 40,
            ratingScale: false,
        });
        expect(out.games).toBe(50); // 10 + 40
        expect(out.wins).toBeCloseTo(26, 6); // 6 + 40 * 0.5
    });

    it("pulls toward the pro estimate as sample grows, staying between prior and pro", () => {
        const cfg = { priorGames: 100, ratingScale: true } as const;
        const small = wr(blendCell({ wins: 60, games: 100 }, 0.5, cfg));
        const large = wr(blendCell({ wins: 600, games: 1000 }, 0.5, cfg));
        expect(small).toBeGreaterThan(0.5);
        expect(small).toBeLessThan(0.6);
        expect(large).toBeGreaterThan(small); // more games -> closer to pro 0.6
        expect(large).toBeLessThan(0.6);
    });

    it("is a no-op when pro and prior agree", () => {
        const out = blendCell({ wins: 25, games: 50 }, 0.5, {
            priorGames: 100,
            ratingScale: true,
        });
        expect(wr(out)).toBeCloseTo(0.5, 9);
    });

    it("stays finite for extreme prior winrates (0 and 1)", () => {
        for (const p of [0, 1]) {
            const out = blendCell({ wins: 5, games: 5 }, p, {
                priorGames: 50,
                ratingScale: true,
            });
            expect(Number.isFinite(out.wins)).toBe(true);
            expect(Number.isFinite(out.games)).toBe(true);
            expect(wr(out)).toBeGreaterThan(0);
            expect(wr(out)).toBeLessThan(1);
        }
    });
});

describe("clampWinrate", () => {
    it("clamps to (0,1) and handles non-finite input", () => {
        expect(clampWinrate(0)).toBeGreaterThan(0);
        expect(clampWinrate(1)).toBeLessThan(1);
        expect(clampWinrate(0.42)).toBe(0.42);
        expect(clampWinrate(NaN)).toBe(0.5);
    });
});

// --- prior readers ---

const prior = {
    championData: {
        "1": {
            statsByRole: {
                0: {
                    games: 100,
                    wins: 55,
                    matchup: { 1: { "2": { championKey: "2", games: 20, wins: 12 } } },
                    synergy: { 1: { "3": { championKey: "3", games: 10, wins: 6 } } },
                },
            },
        },
    },
} as unknown as Dataset;

describe("prior readers", () => {
    it("base winrate reads wins/games, else 0.5", () => {
        expect(priorBaseWinrate(prior, "1", 0)).toBeCloseTo(0.55, 9);
        expect(priorBaseWinrate(prior, "1", 1)).toBe(0.5); // role absent
        expect(priorBaseWinrate(prior, "999", 0)).toBe(0.5); // champ absent
    });

    it("matchup winrate reads the cell, else falls back to base", () => {
        expect(priorMatchupWinrate(prior, "1", 0, 1, "2")).toBeCloseTo(0.6, 9);
        // missing matchup -> base rate for champ 1 in role 0
        expect(priorMatchupWinrate(prior, "1", 0, 2, "999")).toBeCloseTo(0.55, 9);
    });

    it("synergy winrate reads the cell, else falls back to base", () => {
        expect(priorSynergyWinrate(prior, "1", 0, 1, "3")).toBeCloseTo(0.6, 9);
        expect(priorSynergyWinrate(prior, "1", 0, 2, "999")).toBeCloseTo(0.55, 9);
    });
});
