import path from "node:path";
import fs from "node:fs";
// import { fileURLToPath } from "node:url";
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.parse(__filename).dir;

export const getAbsolutePath = (
  absoluteOrRelativePath: string,
  cwd?: string,
) => {
  if (path.isAbsolute(absoluteOrRelativePath)) {
    if (fs.existsSync(absoluteOrRelativePath)) {
      return absoluteOrRelativePath;
    }
    return;
  }

  if (!cwd) {
    return;
  }

  const absolutePath = path.join(cwd, absoluteOrRelativePath);
  if (fs.existsSync(absolutePath)) {
    return absolutePath;
  }

  return;
};
