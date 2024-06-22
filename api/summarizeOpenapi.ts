/**
Serverless function to get all operationId/summary pairs for any openapi in text or json
*/
export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const openapiUrl = url.pathname.split("/").slice(2).join("/");
  const isJson = request.headers.get("accept") === "application/json";

  //use stuff from explorer I already made

  return new Response("Hello, World!");
};
