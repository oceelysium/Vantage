import {
    JSXElement,
    createContext,
    createEffect,
    createResource,
    useContext,
} from "solid-js";
import {
    DATASET_VERSION,
    Dataset,
} from "@draftgap/core/src/models/dataset/Dataset";
import {
    type Tier,
    DEFAULT_TIER,
    tierDatasetName,
} from "@draftgap/core/src/models/Tier";
import { useUser } from "./UserContext";

// Where the soloqueue datasets live. Default is same-origin (relative), i.e. the
// JSON files are bundled into the site under public/datasets/ and served by the
// site itself — no bucket or CORS needed. Set VITE_DATASET_BASE_URL to a
// bucket/CDN URL to host them elsewhere instead.
const DATASET_BASE_URL = import.meta.env.VITE_DATASET_BASE_URL ?? "";

const soloqUrl = (fileName: string) =>
    `${DATASET_BASE_URL}/datasets/v${DATASET_VERSION}/${fileName}.json`;

// The pro dataset is produced locally (bun run pro:local). By default it's served
// by the static site from apps/frontend/public/datasets/ (relative path). To host
// it on a bucket instead, set VITE_PRO_DATASET_URL to its full URL. There is a
// single pro dataset, so both the current-patch and 30-days slots point at it.
const PRO_URL =
    import.meta.env.VITE_PRO_DATASET_URL ?? "/datasets/pro-current-patch.json";

const fetchFrom = async (url: string): Promise<Dataset | undefined> => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        return (await response.json()) as Dataset;
    } catch (err) {
        console.error(err);
        return undefined;
    }
};

// Fetch a soloqueue slot at a given tier, gracefully falling back to the
// default-tier file when the requested tier hasn't been built yet.
const fetchSoloq = async (
    slot: "30-days" | "current-patch",
    tier: Tier,
): Promise<Dataset | undefined> => {
    const ds = await fetchFrom(soloqUrl(tierDatasetName(slot, tier)));
    if (ds || tier === DEFAULT_TIER) return ds;
    return fetchFrom(soloqUrl(slot));
};

function createDatasetContext() {
    const { config } = useUser();
    const source = () => config.dataSource ?? "soloq";
    const tier = () => config.tier ?? DEFAULT_TIER;
    // Refetch whenever either the data source or the tier changes.
    const key = () => `${source()}|${tier()}`;

    const [dataset] = createResource(key, (k) => {
        const [src, t] = k.split("|") as [string, Tier];
        return src === "pro"
            ? fetchFrom(PRO_URL)
            : fetchSoloq("current-patch", t);
    });

    const [dataset30Days] = createResource(key, (k) => {
        const [src, t] = k.split("|") as [string, Tier];
        return src === "pro" ? fetchFrom(PRO_URL) : fetchSoloq("30-days", t);
    });

    const isLoaded = () =>
        dataset() !== undefined && dataset30Days() !== undefined;

    createEffect(() => {
        (window as any).DRAFTGAP_DEBUG = (window as any).DRAFTGAP_DEBUG || {};
        // eslint-disable-next-line solid/reactivity
        (window as any).DRAFTGAP_DEBUG.dataset = dataset;
        // eslint-disable-next-line solid/reactivity
        (window as any).DRAFTGAP_DEBUG.dataset30Days = dataset30Days;
    });

    return {
        dataset,
        dataset30Days,
        isLoaded,
    };
}

const DatasetContext = createContext<ReturnType<typeof createDatasetContext>>();

export function DatasetProvider(props: { children: JSXElement }) {
    return (
        <DatasetContext.Provider value={createDatasetContext()}>
            {props.children}
        </DatasetContext.Provider>
    );
}

export function useDataset() {
    const useCtx = useContext(DatasetContext);
    if (!useCtx) throw new Error("No DatasetContext found");

    return useCtx;
}
