import { Command } from "commander";
import { call_api } from "../callApi";
import { packageJson } from "../utils";
import { call_api_and_print, valid_pubsub_channel } from "./misc";

export const install_pubsub_command = (program: Command) => {
  program
    .command("pub")
    .description("publish message")
    .argument("<string>", "message body")
    .option("--json", "auto try format response body to json", true)
    .option("-c, --channel <name>", "channel name")
    .option("-s, --server [address]", "server address", "localhost:9292")
    .option("-m, --multicast", "message multicast", true)
    .option("-c, --cache", "message cache", false)
    .action(
      async (
        message: string,
        {
          multicast,
          cache,
          channel,
          server,
          json,
        }: {
          json: boolean;
          server: string;
          channel: string;
          multicast: boolean;
          cache: boolean;
        }
      ) => {
        valid_pubsub_channel(channel);
        await call_api_and_print({
          server,
          pathname: channel,
          json,
          payload: message,
          query: {
            multicast,
            cache,
          },
          headers: {
            "pb-cli-method": "pub",
            "pb-cli-version": packageJson.version,
          },
        });
      }
    );
  program
    .command("sub")
    .description("subcribe message")
    .option("--json", "auto try format response body to json", true)
    .option("-c, --channel <name>", "channel name")
    .option("-s, --server [address]", "server address", "localhost:9292")
    .option("-m, --mime [string]", "custom mime type")
    .option("-p, --persist", "persist connect", false)
    .action(
      async ({
        persist,
        mime,
        channel,
        server,
        json,
      }: {
        json: boolean;
        server: string;
        channel: string;
        mime: string;
        persist: boolean;
      }) => {
        valid_pubsub_channel(channel);
        if (persist) {
          await call_api({
            server_address: server,
            pathname: channel,
            query: {
              mime,
              persist,
            },
            on_data: (data) => console.log(data.toString()),
          });
        } else {
          await call_api_and_print({
            server,
            pathname: channel,
            json,
            query: {
              mime,
            },
            headers: {
              "pb-cli-method": "sub",
              "pb-cli-version": packageJson.version,
            },
          });
        }
      }
    );
};
