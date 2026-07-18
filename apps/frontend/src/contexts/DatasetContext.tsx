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
import { useUser } from "./UserContext";

// Host for the soloqueue datasets. Defaults to the upstream DraftGap bucket for
// convenience; set VITE_DATASET_BASE_URL to your own host before deploying
// anything public so you aren't serving data at the upstream author's expense.
const DATASET_BASE_URL =
    import.meta.env.VITE_DATASET_BASE_URL ?? "https://bucket.draftgap.com";

const soloqUrl = (name: "30-days" | "current-patch") =>
    `${DATASET_BASE_URL}/datasets/v${DATASET_VERSION}/${name}.json`;

// The pro dataset is produced locally (bun run pro:local) and served by Vite from
// apps/frontend/public/datasets/. There is a single pro dataset, so both the
// current-patch and 30-days slots point at it in pro mode.
const PRO_URL = "/datasets/pro-current-patch.json";

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

function createDatasetContext() {
    const { config } = useUser();
    const source = () => config.dataSource ?? "soloq";

    const [dataset] = createResource(source, (src) =>
        fetchFrom(src === "pro" ? PRO_URL : soloqUrl("current-patch")),
    );

    const [dataset30Days] = createResource(source, (src) =>
        fetchFrom(src === "pro" ? PRO_URL : soloqUrl("30-days")),
    );

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
