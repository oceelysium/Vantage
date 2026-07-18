/**
 * Minimal, dependency-free RFC 4180 CSV parser.
 *
 * Oracle's Elixir CSVs contain quoted fields (team names, player names) that can
 * embed commas and, rarely, newlines, so a naive split on "," is not safe. This
 * parser handles quoting, escaped quotes ("") and CRLF line endings.
 *
 * The whole file is parsed in memory; OE year files are tens of MB, which is fine
 * for a batch build. Swap for a streaming parser if memory ever becomes a concern.
 */

/** Parse CSV text into an array of raw string cells per row (including the header row). */
export function parseCsvRows(text: string): string[][] {
    const rows: string[][] = [];
    let field = "";
    let row: string[] = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    // escaped quote
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
            continue;
        }

        if (ch === '"') {
            inQuotes = true;
        } else if (ch === ",") {
            row.push(field);
            field = "";
        } else if (ch === "\n") {
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else if (ch === "\r") {
            // ignore; handled with the following \n (or end of file)
        } else {
            field += ch;
        }
    }

    // flush a trailing row only if there is pending content, so a file that ends
    // with a newline does not produce a phantom empty row.
    if (field !== "" || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows;
}

/**
 * Parse CSV text into row objects keyed by the header row.
 * Blank trailing lines are skipped.
 */
export function parseCsv(text: string): Record<string, string>[] {
    const rows = parseCsvRows(text);
    if (rows.length === 0) return [];

    const header = rows[0];
    const out: Record<string, string>[] = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // skip blank lines (a lone empty field)
        if (row.length === 1 && row[0] === "") continue;

        const record: Record<string, string> = {};
        for (let c = 0; c < header.length; c++) {
            record[header[c]] = row[c] ?? "";
        }
        out.push(record);
    }

    return out;
}
