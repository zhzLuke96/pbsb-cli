import { Command } from "commander";
import { call_api_and_print } from "./misc";

export const install_call_command = (program: Command) => {
  program
    .command("call")
    .description("simple call server")
    .argument("<pathname>", "pathname")
    .option("--json", "format response body to json", true)
    .option("-s, --server [address]", "server address", "localhost:9292")
    .option("-p, --payload [string]", "payload data")
    .option("-q, --query [string]", "query data")
    .action(
      async (
        pathname: string,
        {
          json,
          server,
          query,
          payload,
        }: { json: boolean; server: string; query?: string; payload?: string }
      ) => {
        console.log({payload, pathname});
        await call_api_and_print({ server, pathname, json, payload, query });
      }
    );
};
