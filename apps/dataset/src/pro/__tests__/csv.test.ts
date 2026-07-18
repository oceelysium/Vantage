import { describe, expect, it } from "bun:test";
import { parseCsv, parseCsvRows } from "../csv";

describe("parseCsvRows", () => {
    it("parses a simple grid", () => {
        expect(parseCsvRows("a,b\n1,2\n3,4\n")).toEqual([
            ["a", "b"],
            ["1", "2"],
            ["3", "4"],
        ]);
    });

    it("handles quoted fields containing commas", () => {
        expect(parseCsvRows('a,b\n"x,y",z\n')).toEqual([
            ["a", "b"],
            ["x,y", "z"],
        ]);
    });

    it("handles escaped quotes", () => {
        expect(parseCsvRows('a\n"say ""hi"""\n')).toEqual([
            ["a"],
            ['say "hi"'],
        ]);
    });

    it("handles embedded newlines inside quotes", () => {
        expect(parseCsvRows('a,b\n"line1\nline2",z\n')).toEqual([
            ["a", "b"],
            ["line1\nline2", "z"],
        ]);
    });

    it("handles CRLF line endings", () => {
        expect(parseCsvRows("a,b\r\n1,2\r\n")).toEqual([
            ["a", "b"],
            ["1", "2"],
        ]);
    });

    it("parses a final row with no trailing newline", () => {
        expect(parseCsvRows("a,b\n1,2")).toEqual([
            ["a", "b"],
            ["1", "2"],
        ]);
    });
});

describe("parseCsv", () => {
    it("keys cells by the header row", () => {
        const rows = parseCsv("name,age\nAda,36\nGrace,44\n");
        expect(rows).toEqual([
            { name: "Ada", age: "36" },
            { name: "Grace", age: "44" },
        ]);
    });

    it("skips blank trailing lines", () => {
        const rows = parseCsv("a\n1\n\n");
        expect(rows).toEqual([{ a: "1" }]);
    });

    it("fills missing trailing cells with empty strings", () => {
        const rows = parseCsv("a,b,c\n1,2\n");
        expect(rows).toEqual([{ a: "1", b: "2", c: "" }]);
    });
});
