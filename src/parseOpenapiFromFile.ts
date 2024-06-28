import fs from "node:fs";
import { OpenAPI3 } from "openapi-typescript";
import { tryParseJson } from "./tryParseJson.js";
import { tryParseYamlToJson } from "./tryParseYamlToJson.js";
import { getAbsolutePath } from "./getAbsolutePath.js";

export const parseOpenapiFromFile = async (
  absoluteOrRelativePath: string,
  cwd?: string,
) => {
  const absolutePath = getAbsolutePath(absoluteOrRelativePath, cwd);
  if (!absolutePath) {
    return { isSuccessful: false, message: "Couldn't find file" };
  }

  const yamlOrJson = fs.readFileSync(absolutePath, "utf8");

  const json =
    tryParseJson<OpenAPI3>(yamlOrJson) ||
    tryParseYamlToJson<OpenAPI3>(yamlOrJson);

  if (!json) {
    return { isSuccessful: false, message: "File could not be parsed" };
  }

  return { isSuccessful: true, message: "Parsed file", result: json };
};
