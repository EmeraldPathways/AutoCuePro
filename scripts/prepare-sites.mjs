import { copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";

await mkdir("dist/.openai", { recursive: true });
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");

const generatedHandler = "dist/server/index.js";
const wrappedHandler = "dist/server/handler.js";

await rm(wrappedHandler, { force: true });
await rename(generatedHandler, wrappedHandler);
await writeFile(
  generatedHandler,
  `import handler from "./handler.js";

export default {
  fetch(request, env, context) {
    return typeof handler === "function"
      ? handler(request, env, context)
      : handler.fetch(request, env, context);
  },
};
`,
);
