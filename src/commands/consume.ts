import { Command } from "commander";
import { call_api, call } from "../callApi";

import { packageJson } from "../utils";
import { ForkKeeper } from "../lib/ForkKeeper";
import { ServerTester } from "../lib/ServerTester";

type ConsumeKeeper = ForkKeeper<
  { type: "ack"; msg_id: string },
  {
    msg_id: string;
    body: any;
  }
>;

const message_loop = async (
  channel: string,
  server: string,
  query: Record<string, any>,
  keeper: ForkKeeper
) => {
  let done = false;
  while (!done) {
    let timeout = false;
    try {
      const { req, resp, body } = await call({
        server_address: server,
        pathname: `/mq/${channel}`,
        query,
        headers: {
          "pb-cli-method": "consume",
          "pb-cli-version": packageJson.version,
        },
      });
      req.end();
      const timer = setTimeout(() => {
        timeout = true;
        req.destroy();
      }, 30 * 1000); // timeout 30s
      const { response } = await resp;
      const resp_body = await body();
      clearTimeout(timer);
      keeper.send({
        msg_id: String(response.headers["pb-msg-id"]),
        body: JSON.parse(resp_body.toString()),
      });
    } catch (error) {
      if (timeout) {
        continue;
      }
      console.log(`[consume:err]error:`);
      console.log("\t", (error as any)?.message || error);
      const tester = new ServerTester(server);
      await tester.test_forever();
    }
  }
};

export const install_consume_command = (program: Command) => {
  program
    .command("consume")
    .description("consume message from message queue")
    .argument("<filename>", "consumer javascript filename")
    .option("-s, --server [address]", "server address", "localhost:9292")
    .requiredOption("-c, --channel <name>", "message queue namespace")
    .option("-a, --ack", "auto ack when message fetched")
    .option(
      "-p, --priority [weight]",
      "The weight of the current consumer in the priority",
      "0"
    )
    .option("-d, --dead", "fetch messages from the dead letter queue")
    .action(
      async (
        script_filename: string,
        {
          channel,
          server,
          ack,
          priority,
          dead,
        }: {
          channel: string;
          server: string;
          ack: boolean;
          priority: string;
          dead: boolean;
        }
      ) => {
        if (!channel) {
          console.log(`error: missing required argument 'channel'`);
          process.exit(1);
        }
        const priorityN = Number(priority);
        if (Number.isNaN(priorityN)) {
          console.log(
            "[consume]",
            `priority must be number, but got ${priority}`
          );
          return;
        }
        const tester = new ServerTester(server);
        await tester.try_ready();

        const keeper: ConsumeKeeper = new ForkKeeper(script_filename);
        message_loop(
          channel,
          server,
          {
            ack,
            dead,
            priority: priorityN,
          },
          keeper
        );
        keeper.on(
          "message",
          ({ type, msg_id }: { type: "ack"; msg_id: string }) => {
            switch (type) {
              case "ack": {
                call_api({
                  server_address: server,
                  pathname: `/mq/ack/${msg_id}`,
                });
                break;
              }
            }
          }
        );
      }
    );
};
