import { describe, expect, it } from "bun:test";
import {
    computeMetrics,
    bestBlended,
    type BacktestReport,
} from "../backtest";

describe("computeMetrics", () => {
    it("scores coin-flip predictions", () => {
        const m = computeMetrics([
            { p: 0.5, y: 1 },
            { p: 0.5, y: 0 },
        ]);
        expect(m.n).toBe(2);
        expect(m.accuracy).toBe(0.5); // p>=0.5 predicts 1
        expect(m.logLoss).toBeCloseTo(Math.log(2), 6); // -ln(0.5)
        expect(m.brier).toBeCloseTo(0.25, 6);
        expect(m.ece).toBeCloseTo(0, 6); // bin mean p == bin mean y
    });

    it("rewards confident, correct predictions", () => {
        const m = computeMetrics([
            { p: 0.9, y: 1 },
            { p: 0.1, y: 0 },
        ]);
        expect(m.accuracy).toBe(1);
        expect(m.logLoss).toBeCloseTo(-Math.log(0.9), 6);
        expect(m.brier).toBeCloseTo(0.01, 6);
    });

    it("punishes confident, wrong predictions with high log-loss", () => {
        const good = computeMetrics([{ p: 0.9, y: 1 }]).logLoss;
        const bad = computeMetrics([{ p: 0.01, y: 1 }]).logLoss;
        expect(bad).toBeGreaterThan(good);
    });

    it("returns zeros for an empty set", () => {
        expect(computeMetrics([])).toEqual({
            n: 0,
            accuracy: 0,
            logLoss: 0,
            brier: 0,
            ece: 0,
        });
    });
});

describe("bestBlended", () => {
    it("selects the blended row with lowest log-loss", () => {
        const report = {
            trainCount: 0,
            testCount: 0,
            baseRate: 0.5,
            rows: [
                { model: "soloq", metrics: metrics(0.69) },
                { model: "blended", k: 0, metrics: metrics(0.70) },
                { model: "blended", k: 100, metrics: metrics(0.66) },
                { model: "blended", k: 400, metrics: metrics(0.68) },
            ],
        } as BacktestReport;
        expect(bestBlended(report)?.k).toBe(100);
    });
});

function metrics(logLoss: number) {
    return { n: 1, accuracy: 0.5, logLoss, brier: 0.25, ece: 0 };
}
