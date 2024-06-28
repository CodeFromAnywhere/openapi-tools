import { generateTypescriptSdk } from "../src/generateTypescriptSdk.js";

export const POST = async (request: Request) => {
  try {
    const body = await request.json();

    // Via endpoint and get a single typesafe SDK client back
    const response = await generateTypescriptSdk(body);

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response("Invalid Body", { status: 400 });
  }
};
