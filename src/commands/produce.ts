import { Command } from "commander";
import { call_api } from "../callApi";

import { packageJson } from "../utils";
import { ForkKeeper } from "../lib/ForkKeeper";
import { ServerTester } from '../lib/ServerTester';

type ProducePayload = {
    data: any;
    ttl?: number;
    priority?: number;
    delay?: number;
    dedup?: boolean;
    uid?: string;
}

export const install_produce_command = (program: Command) => {
  program
    .command("produce")
    .description("produce message to message queue")
    .argument("<filename>", "producer javascript filename")
    .option("-s, --server [address]", "server address", "localhost:9292")
    .option("-c, --channel <name>", "message queue namespace")
    .action(
      async (
        script_filename: string,
        { channel, server }: { channel: string; server: string }
      ) => {
        const tester = new ServerTester(server);
        await tester.try_ready();
        
        const keeper = new ForkKeeper<ProducePayload>(script_filename);

        keeper.on("message", ({ data, ...query }) => {
          // TODO retry / error catch
          call_api({
            server_address: server,
            pathname: `/mq/${channel}`,
            query,
            payload: data,
            headers: {
              "pb-cli-method": "produce",
              "pb-cli-version": packageJson.version,
            },
          });
        });
      }
    );
};
