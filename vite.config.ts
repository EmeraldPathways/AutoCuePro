import vinext from "vinext";
import { defineConfig } from "vite";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    vinext({
      cache: { cdn: cdnAdapter() },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  environments: {
    rsc: {
      resolve: {
        noExternal: true,
      },
    },
    ssr: {
      resolve: {
        noExternal: true,
      },
    },
  },
});
