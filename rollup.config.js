import cjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import esbuild from "rollup-plugin-esbuild";
import json from "@rollup/plugin-json";
import alias from "@rollup/plugin-alias";

const production = process.env.NODE_ENV === "production";

export default [
  {
    input: `src/index.ts`,
    plugins: [
      resolve(),
      cjs(),
      json(),
      esbuild({
        minify: production,
        minifyIdentifiers: production,
        minifySyntax: production,
        minifyWhitespace: production,
      }),
    ],
    output: [
      {
        file: `dist/pbsb-cli.js`,
        format: "cjs",
        sourcemap: !production,
        exports: "named",
      },
    ],
  },
];
