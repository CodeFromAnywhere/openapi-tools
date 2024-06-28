import { fetchWithTimeout } from "./fetchWithTimeout.js";
import { type OpenAPI3 } from "openapi-typescript";

const openapis: { [url: string]: OpenAPI3 } = {};

/** Fetches openapi but with cache */
export const fetchOpenapi = async (openapiUrl: string | undefined) => {
  if (!openapiUrl) {
    return;
  }

  if (openapis[openapiUrl]) {
    // NB: cached in memory
    return openapis[openapiUrl];
  }

  const isYaml = openapiUrl.endsWith(".yaml");

  const { json, status, statusText, text } = await fetchWithTimeout<OpenAPI3>(
    openapiUrl,
    { headers: isYaml ? undefined : { Accept: "application/json" } },
    30000,
  );

  console.log({ openapiUrl, json, text, status, statusText });

  if (json) {
    // NB: set cache
    openapis[openapiUrl] = json;
  }

  return json || undefined;
};
