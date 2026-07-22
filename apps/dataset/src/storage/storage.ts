import {
    DATASET_VERSION,
    type Dataset,
} from "@draftgap/core/src/models/dataset/Dataset";
import { bytesToHumanReadable } from "../utils";
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";

// When DATASET_LOCAL_DIR is set, datasets are read/written on the local
// filesystem (no S3/bucket, no credentials) under
// <DATASET_LOCAL_DIR>/v<VERSION>/<name>.json. This is the no-infra path for
// self-hosting. Otherwise the S3 client is used (imported lazily so local mode
// never requires S3 credentials).
const LOCAL_DIR = process.env.DATASET_LOCAL_DIR;

function localPath(name: string): string {
    return resolve(LOCAL_DIR!, `v${DATASET_VERSION}`, `${name}.json`);
}

export async function getDataset({ name }: { name: string }): Promise<Dataset> {
    if (LOCAL_DIR) {
        const body = await readFile(localPath(name), "utf8");
        return JSON.parse(body) as Dataset;
    }

    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { client } = await import("./client");
    const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET || "draftgap",
        Key: `datasets/v${DATASET_VERSION}/${name}.json`,
    });
    const response = await client.send(command);
    const body = await response.Body?.transformToString()!;
    return JSON.parse(body) as Dataset;
}

export async function storeDataset(
    dataset: Dataset,
    { name }: { name: string },
) {
    const body = JSON.stringify(dataset);

    if (LOCAL_DIR) {
        const path = localPath(name);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, body);
        console.log(
            `Stored dataset ${path} of size ${bytesToHumanReadable(
                body.length,
            )}`,
        );
        return;
    }

    const { PutObjectCommand, PutBucketCorsCommand } = await import(
        "@aws-sdk/client-s3"
    );
    const { client } = await import("./client");

    const Key = `datasets/v${DATASET_VERSION}/${name}.json`;
    const Bucket = process.env.S3_BUCKET || "draftgap";
    await client.send(
        new PutObjectCommand({
            Bucket,
            Key,
            Body: body,
            ContentType: "application/json",
        }),
    );
    console.log(
        `Stored dataset ${Bucket}/${Key} of size ${bytesToHumanReadable(
            body.length,
        )}`,
    );

    await client.send(
        new PutBucketCorsCommand({
            Bucket,
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: ["*"],
                        AllowedMethods: ["GET"],
                        AllowedOrigins: ["*"],
                        MaxAgeSeconds: 3000,
                    },
                ],
            },
        }),
    );
}
