import { notEmpty } from "from-anywhere";
import { getOpenapiOperations } from "openapi-util";

/**
Serverless function to get all operationId/summary pairs for any openapi in text or json
*/
export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const openapiUrl = url.searchParams.get("openapiUrl");
  const isJson = request.headers.get("accept") === "application/json";

  const openapiId = openapiUrl;
  const openapiDetails =
    openapiId && openapiUrl
      ? await getOpenapiOperations(openapiId, openapiUrl)
      : undefined;
  console.log({ openapiUrl, openapiDetails });

  if (!openapiDetails) {
    return;
  }

  const { tags } = openapiDetails;
  const operationsPerTag = tags
    .concat({ name: "__undefined", description: "No tags present" })
    .map((tag) => {
      const description = tag.description
        ? `: ${tag.description}`
        : tag.externalDocs
        ? `: ${tag.externalDocs.url}`
        : "";

      const filtered = openapiDetails.operations.filter((x) =>
        tag.name === "__undefined"
          ? !x.operation.tags?.length
          : x.operation.tags?.includes(tag.name),
      );

      if (filtered.length === 0) {
        return null;
      }

      const { name } = tag;

      return { name, description, operations: filtered };
    })
    .filter(notEmpty);

  if (isJson) {
    return Response.json(operationsPerTag);
  }

  const llmString = operationsPerTag
    .map(({ name, description, operations }) => {
      return `${name}${description}\n${operations
        .map((item) => {
          return `- ${item.id} - ${item.operation.summary}`;
        })
        .join("\n")}`;
    })
    .filter(notEmpty)
    .join("\n\n");

  return new Response(llmString);
};
