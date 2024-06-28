import openapiTS, {
  OpenAPI3,
  OperationObject,
  PathItemObject,
  astToString,
} from "openapi-typescript";
import { fetchOpenapi } from "./fetchOpenapi.js";
import { parseOpenapiFromFile } from "./parseOpenapiFromFile.js";
import { camelCase, mergeObjectsArray, notEmpty } from "from-anywhere";

const createClient = `
//<script>

export type PromiseOrNot<T> = Promise<T> | T;

export type GetParameters<K extends keyof operations> =
  | operations[K]["parameters"]["cookie"]
  | operations[K]["parameters"]["header"]
  | operations[K]["parameters"]["path"]
  | operations[K]["parameters"]["query"];

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

// Typescript magic from: https://stackoverflow.com/questions/63542526/merge-discriminated-union-of-object-types-in-typescript
type MergeIntersection<U> = UnionToIntersection<U> extends infer O
  ? { [K in keyof O]: O[K] }
  : never;

type MergeParameters<P> = MergeIntersection<Extract<P, {}>>;

export type EndpointBody<T extends keyof operations> =
  (operations[T]["requestBody"] extends {}
    ? operations[T]["requestBody"]["content"]["application/json"]
    : {}) &
    MergeParameters<GetParameters<T>>;

export type EndpointContext<K extends keyof operations> =
  (operations[K]["requestBody"] extends {}
    ? operations[K]["requestBody"]["content"]["application/json"]
    : {}) &
    MergeParameters<GetParameters<K>>;

export type ResponseType<T extends keyof operations> =
  operations[T]["responses"][200]["content"]["application/json"];

export type Endpoint<T extends keyof operations> = (
  context: EndpointContext<T>,
) => PromiseOrNot<ResponseType<T>>;

export const createClient = (config: {
  timeoutSeconds?: number;
  /**
   * Server URL without slash at the end
   */
  baseUrl?: string;
  headers: { [key: string]: string };
}) => {
  const client = async <K extends keyof operations>(
    operation: K,
    body?: EndpointContext<K>,

    /** NB: always use getPersonConfig for this! */
    customConfiguration?: {
      baseUrl?: string;
      headers?: { [key: string]: string };
    },
  ): Promise<
    operations[K]["responses"][200]["content"]["application/json"]
  > => {
    const details = operationUrlObject[operation];
    const { headers, baseUrl } = customConfiguration || config;

    if (!details) {
      throw new Error("No details found for operation:" + operation");
    }
    if (!baseUrl) {
      throw new Error("No baseUrl found");
    }

    const fullUrl = baseUrl + details.path;

    try {
      const abortController = new AbortController();
      const id = setTimeout(
        () => abortController.abort(),
        (config.timeoutSeconds || 30) * 1000,
      );

      const response = await fetch(fullUrl, {
        method: details.method,
        signal: abortController.signal,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
        .then(async (response) => {
          if (!response.ok) {
            console.log(
              "Response not ok",
              response.status,
              response.statusText,
            );
          }
          if (!response.headers.get("Content-Type")?.includes("json")) {
            const headers = Array.from(response.headers.keys()).map((key) => ({
              [key]: response.headers.get(key),
            }));

            console.log("No JSON?", headers);
          }
          const responseText = await response.text();

          try {
            return JSON.parse(responseText);
          } catch (e) {
            console.log("couldn't parse JSON", {
              responseText,
              operation,
              body,
              customConfiguration,
            });
          }
        })
        .catch((error) => {
          console.log({
            explanation: "Your request could not be executed, you may be disconnected or the server may not be available. ",
            error,
            errorStatus: error.status,
            errorString: String(error),
            operation,
            body,
            customConfiguration,
          });

          return {
            isSuccessful: false,
            isNotConnected: true,
            message:
              "Could not connect to any API. Please see your API configuration.",
          };
        });

      clearTimeout(id);
      return response;
    } catch (e) {
      return {
        isSuccessful: false,
        isNotConnected: true,
        message:
          "The API didn't resolve, and the fetch crashed because of it: " +
          String(e),
      } as any;
    }
  };
  return client;
};

//</script>
`;

const httpMethods = [
  "post",
  "get",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
] as const;
type HttpMethod = (typeof httpMethods)[number];
/**
 * Create my own codegen function wrapping `typescript-openapi` and make it accessible as api
 */

export const generateTypescriptSdkFile = async (context: {
  openapiUrlOrPath: string;
  cwd?: string;
}) => {
  const { openapiUrlOrPath, cwd } = context;

  const isUrl = URL.canParse(openapiUrlOrPath);

  const fetchResult = isUrl ? await fetchOpenapi(openapiUrlOrPath) : undefined;

  const openapiResult = isUrl
    ? fetchResult
      ? {
          isSuccessful: true,
          message: "Fetched",
          result: fetchResult,
        }
      : { isSuccessful: false, message: "Fetch failed" }
    : await parseOpenapiFromFile(openapiUrlOrPath, cwd);

  if (!openapiResult.result) {
    return { isSuccessful: false, message: openapiResult.message };
  }

  const openapi = openapiResult.result;

  const schemaKeys = openapi.components?.schemas
    ? Object.keys(openapi.components.schemas)
    : undefined;

  const ast = await openapiTS(openapi, {});
  const contents = astToString(ast);

  const pathKeys = openapi?.paths ? Object.keys(openapi.paths) : [];
  const operationIds = pathKeys
    .map((path) => {
      const methods = !!openapi?.paths?.[path]
        ? Object.keys(openapi.paths[path]!).filter((method) =>
            ([...httpMethods] as string[]).includes(method),
          )
        : [];

      const operationIds = methods.map((method) => {
        // 1) Get the operation Id
        const pathItemObject = openapi?.paths?.[path] as
          | PathItemObject
          | undefined;
        const operationObject = pathItemObject?.[method as HttpMethod] as
          | OperationObject
          | undefined;
        // NB: will use method:path if no operationId is present
        const operationId = operationObject?.operationId || `${method}:${path}`;

        return { path, method, operationId };
      });
      return operationIds;
    })
    .flat();

  const operationUrlObject = operationIds
    .map(({ method, operationId, path }) => ({
      [operationId]: { method, path },
    }))
    .reduce((previous, current) => {
      return { ...previous, ...current };
    }, {});

  // console.log({ operationUrlObject });

  const code = `${contents}

${schemaKeys
  ?.map((key) => {
    return `export type ${key} = components["schemas"]["${key}"]`;
  })
  .join("\n")}
  
export const operationUrlObject = ${JSON.stringify(
    operationUrlObject,
    undefined,
    2,
  )}
export const operationKeys = Object.keys(operationUrlObject);`;

  const baseUrl = openapi.servers?.[0]?.url;

  return { isSuccessful: true, message: "Made script", code, baseUrl };
};

const getClientScript = (
  openapis: { slug: string; baseUrl: string; envKeyName: string }[],
) => {
  const imports = openapis
    .map((item) => {
      const { slug } = item;
      const newObjectName = camelCase(`${slug}_operationUrlObject`);
      const newOperationsName = camelCase(`${slug}_operations`);
      return `import { operationUrlObject as ${newObjectName}, operations as ${newOperationsName} } from "./${slug}.js";`;
    })
    .join("\n");

  const clients = openapis
    .map((item) => {
      const { slug, baseUrl, envKeyName } = item;
      //<script> // put it down to get color highlights (with string-highlight extension)
      return ` 

export const ${camelCase(slug)} = createClient({
  baseUrl: "${baseUrl}",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: "Bearer " + process.env.${envKeyName}
  },
  timeoutSeconds: 60,
});
`;
      //</script>
    })
    .join("\n\n");

  return `import { createClient } from "./createClient.js";
  
${imports}


${clients}`;
};

type GenerateSdkContext = {
  openapis: {
    /** Used as prefix for the operation (e.g. `sdk.userCrud.create`) */
    slug: string;
    envKeyName: string;
    /** If given, will only put this subset in the SDK */
    operationIds?: string[];
    openapiUrl: string;
  }[];
};

export const generateTypescriptSdk = async (context: GenerateSdkContext) => {
  const { openapis } = context;
  const sdks = (
    await Promise.all(
      openapis.map(async (item) => {
        const { openapiUrl, slug, envKeyName, operationIds } = item;

        const { code, baseUrl } = await generateTypescriptSdkFile({
          openapiUrlOrPath: openapiUrl,
        });

        if (!code || !baseUrl) {
          return;
        }

        return { code, baseUrl, slug, envKeyName };
      }),
    )
  ).filter(notEmpty);

  const clientScript = getClientScript(sdks.map(({ code, ...rest }) => rest));

  const sdkFiles = mergeObjectsArray(
    sdks.map((item) => ({ [`${item.slug}.ts`]: item.code })),
  );

  const files: { [filePath: string]: string } = {
    ["client.ts"]: clientScript,
    [`createClient.ts`]: createClient,
    ...sdkFiles,
  };

  return { files };
};
