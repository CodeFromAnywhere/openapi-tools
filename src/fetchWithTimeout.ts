import { tryParseJson } from "./tryParseJson.js";
import { tryParseYamlToJson } from "./tryParseYamlToJson.js";
/**
 * Sets timeout to 5 minutes by default
 *
 * Better fetch that also returns status and statusText along with the raw text result and JSON.
 */
export const fetchWithTimeout = async <T extends any>(
  input: string | Request | URL,
  init?: RequestInit,
  timeoutMs?: number,
  isNoJson?: boolean,
  isNoText?: boolean,
) => {
  const { status, statusText, text, response } = await fetchTextWithTimeout(
    input,
    init,
    timeoutMs,
    isNoText,
  );
  const json =
    text && !isNoJson
      ? tryParseJson<T>(text) || tryParseYamlToJson<T>(text)
      : null;

  return { text, json, status, statusText, response };
};

export const fetchTextWithTimeout = async (
  input: string | Request | URL,
  init?: RequestInit,
  timeoutMs?: number,
  isNoText?: boolean,
) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 300000);

    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    }).catch((err: any) => {
      console.log({ err });
      // console.log(Object.keys(err.cause));
      return err.cause.code as string; // Error caused by fetch
    });

    clearTimeout(timeoutId);

    if (typeof response === "string") {
      return { statusText: response };
    }

    const status = response?.status;
    const statusText = response?.statusText;
    // console.log({ status, statusText });
    const text = isNoText ? undefined : await response.text();

    return { text, status, statusText, response };
  } catch (e) {
    return { text: undefined, status: 500, statusText: "Catched fetch" };
  }
};
