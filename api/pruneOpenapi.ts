import { notEmpty } from "from-anywhere";
import { OpenapiDocument, resolveSchemaRecursive } from "openapi-util";
import { OpenAPIV3 } from "openapi-types";

/**
 * Serverless function to get a simplified openapi that is dereferenced and only contains the operationIds you care about.
 */
export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const openapiUrl = url.searchParams.get("openapiUrl");
  const operationIds = url.searchParams.get("operationIds")?.split(",");
  if (!openapiUrl) {
    return new Response("No OpenAPI Url provided", { status: 422 });
  }
  if (!operationIds) {
    return new Response("No operationIds provided", { status: 422 });
  }

  const accept = request.headers.get("accept");

  const isYaml =
    accept &&
    ["application/yaml", "text/yaml", "application/openapi+yaml"].includes(
      accept,
    );

  const isJson =
    accept && ["application/json", "application/openapi+json"].includes(accept);

  const isMarkdown = !isJson && !isYaml;

  // 1) dereference
  const openapi = (await resolveSchemaRecursive({
    documentUri: openapiUrl,
    shouldDereference: true,
  })) as OpenapiDocument | undefined;

  if (!openapi) {
    return new Response("Couldn't find openapi", { status: 404 });
  }
  console.log({ openapi, openapiUrl });

  const allowedMethods = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "head",
    "options",
  ];

  const pathKeys = Object.keys(openapi.paths);
  const operations = (
    await Promise.all(
      pathKeys.map(async (path) => {
        const item: OpenAPIV3.PathItemObject | undefined =
          openapi.paths![path as keyof typeof openapi.paths];

        if (!item) {
          return;
        }

        const methods = Object.keys(item).filter((method) =>
          allowedMethods.includes(method),
        );

        const pathMethods = await Promise.all(
          methods.map(async (method) => {
            const operation = item[
              method as keyof typeof item
            ] as OpenAPIV3.OperationObject;

            const parameters = operation.parameters || item.parameters;

            const id = operation.operationId || path.slice(1) + "=" + method;
            return {
              path,
              method: method,
              operation,
              parameters,
              id,
            };
          }),
        );

        return pathMethods;
      }),
    )
  )
    .filter(notEmpty)
    .flat();

  // NB: Either get all of them or only a selection.
  const selectedOperations = operations.filter((x) => {
    return operationIds.includes(x.id);
  });

  const paths: { [key: string]: undefined | { [key: string]: any } } = {};

  // 2) pick needed operationIds, clean out the rest
  selectedOperations.map((operationItem) => {
    const { path, method, parameters, id, operation } = operationItem;

    if (!paths[path]) {
      // first make the path
      paths[path] = {};
    }

    // then set the method
    paths[path]![method] = { ...operation, parameters, operationId: id };
  });

  // 3) clean up schemas
  const newOpenapiJson: OpenapiDocument = {
    ...openapi,
    components: { ...openapi.components, schemas: undefined },
    // only change paths
    paths,
  };

  if (isJson || true) {
    return new Response(JSON.stringify(newOpenapiJson), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }

  if (isYaml) {
    //TODO: Use https://eemeli.org/yaml/#api-overview
    const yamlString = newOpenapiJson;

    return new Response(JSON.stringify(yamlString), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }

  // TODO:
  return new Response(
    "Hello world. Idk what to write here... Maybe a typescript version?",
    { headers: { "Content-Type": "text/plain" }, status: 200 },
  );
};
