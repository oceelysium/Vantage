import { describe, expect, it } from "bun:test";
import {
    buildChampionMap,
    mapChampionName,
    normalizeName,
} from "../champion-map";
import { MOCK_CHAMPIONS } from "./mock-champions";

const map = buildChampionMap(MOCK_CHAMPIONS);

describe("normalizeName", () => {
    it("strips punctuation, spaces and case", () => {
        expect(normalizeName("Kai'Sa")).toBe("kaisa");
        expect(normalizeName("Nunu & Willump")).toBe("nunuwillump");
        expect(normalizeName("Lee Sin")).toBe("leesin");
    });
});

describe("mapChampionName", () => {
    it("maps by display name", () => {
        expect(mapChampionName("Ahri", map)).toBe("103");
        expect(mapChampionName("Renata Glasc", map)).toBe("888");
    });

    it("maps punctuated names", () => {
        expect(mapChampionName("Kai'Sa", map)).toBe("145");
        expect(mapChampionName("Nunu & Willump", map)).toBe("20");
    });

    it("maps by internal id and via alias", () => {
        expect(mapChampionName("MonkeyKing", map)).toBe("62"); // id
        expect(mapChampionName("Wukong", map)).toBe("62"); // name
        expect(mapChampionName("Nunu", map)).toBe("20"); // bare id / alias
    });

    it("throws loudly on an unmapped champion", () => {
        expect(() => mapChampionName("Not A Champion", map)).toThrow(
            /Unmapped champion/,
        );
    });

    it("covers every champion in the list (name and id)", () => {
        for (const c of MOCK_CHAMPIONS) {
            expect(mapChampionName(c.name, map)).toBe(c.key);
            expect(mapChampionName(c.id, map)).toBe(c.key);
        }
    });
});
