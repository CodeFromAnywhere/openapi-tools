/**
 * Serverless function to get a simplified openapi that is dereferenced and only contains the operationIds you care about.
 */
export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const openapiUrl = url.searchParams.get("openapiUrl");
  const operationIds = url.searchParams.get("operationIds")?.split(",");
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

  // 2) pick needed operationIds, clean out the rest

  // 3) clean up schemas

  return new Response("Hello, World!");
};
