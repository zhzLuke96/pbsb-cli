import { Command } from "commander";
import parse_headers from "parse-headers";
import { urlJoin } from "../urlJoin";
import { packageJson } from "../utils";
import { call_api_and_print } from "./misc";

// * cli just supprt req call
export const install_reqres_command = (program: Command) => {
  program
    .command("req")
    .description("request message")
    .option("--json", "format response body to json", true)
    .requiredOption("-c, --channel <name>", "channel name")
    .option("-s, --server [address]", "server address", "localhost:9292")
    .option("-H, --headers [string]", "Pass custom header(s) to server")
    .action(
      async ({
        channel,
        server,
        headers,
        json,
      }: {
        channel: string;
        server: string;
        headers?: string;
        json: boolean;
      }) => {
        const headers_obj = parse_headers(headers || "");
        const uri = urlJoin("req", channel);
        await call_api_and_print({
          server,
          json,
          headers: {
            ...headers_obj,
            "pb-cli-method": "req",
            "pb-cli-version": packageJson.version,
          },
          pathname: uri,
        });
      }
    );
};
