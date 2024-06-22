import { notEmpty } from "from-anywhere";
import { getOpenapiOperations } from "openapi-util";

/**
Serverless function to get all operationId/summary pairs for any openapi in text or json
*/
export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const openapiUrl = url.pathname.split("/").slice(2).join("/");
  const isJson = request.headers.get("accept") === "application/json";

  const openapiId = openapiUrl;
  const openapiDetails =
    openapiId && openapiUrl
      ? await getOpenapiOperations(openapiId, openapiUrl)
      : undefined;

  if (!openapiDetails) {
    return;
  }

  const { tags } = openapiDetails;

  const llmString = tags
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

      return filtered.length === 0
        ? null
        : `${tag.name}${description}\n${filtered
            .map((item) => {
              return `- ${item.id} - ${item.operation.summary}`;
            })
            .join("\n")}`;
    })
    .filter(notEmpty)
    .join("\n\n");

  //use stuff from explorer I already made

  return new Response(llmString);
};
