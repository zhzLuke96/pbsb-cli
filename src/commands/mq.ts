import { fork } from "child_process";
import { Command } from "commander";
import { existsSync } from "fs";
import { IncomingMessage } from "http";
import path from "path";
import { call_api, call_api_json } from "../callApi";

import { promisify } from "util";

const wait = promisify(setTimeout);

const filepath_valid = (filepath: string) => {
  const pth = path.isAbsolute(filepath)
    ? filepath
    : path.join(process.cwd(), filepath);
  if (!existsSync(pth)) {
    throw new Error(`cant find file from: ${pth}`);
  }
  return pth;
};

const run_child = (filename: string) => {
  const filepath = filepath_valid(filename);
  const { ext } = path.parse(filepath);
  if (ext !== ".js") {
    throw new Error(`[${ext}] type of script is not supported`);
  }
  // FIXME: 打包之后没法fork，typescript文件
  // ------ pkg 打包之后用不了，需要有一种办法把ts-node打包到执行文件里
  // ------ 并且 pkg 还要可以正确的传递 execArgv (现在的应该是并没有传对)
  //
  // const isTS = ext === ".ts";
  // if (isTS) {
  //   return fork(filepath, [], {
  //     execArgv: ["-r", "ts-node/register"],
  //   });
  // }
  return fork(filepath);
};

const message_loop = async (
  channel: string,
  server: string,
  query: Record<string, any>,
  on_data: (resp: { response: IncomingMessage; body: any }) => any
) => {
  let done = false;
  while (!done) {
    try {
      const resp = await call_api_json({
        server_address: server,
        pathname: `/mq/${channel}`,
        query,
      });
      on_data(resp);
    } catch (error) {
      if (error instanceof Error) {
        console.log(`[message_loop]`, error.message);
      } else {
        console.log(error);
      }
      await wait(5000);
    }
  }
};

export const install_mq_command = (program: Command) => {
  program
    .command("consume")
    .description("consume message from message queue")
    .argument("<filename>", "consumer javascript filename")
    .option("-s, --server [address]", "server address", "localhost:9292")
    .option("-c, --channel <name>", "message queue namespace")
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
        const child = run_child(script_filename);
        message_loop(
          channel,
          server,
          {
            ack,
            dead,
            priority: Number(priority),
          },
          async ({ response, body }) => {
            child.send({ msg_id: response.headers["pb-msg-id"], body });
          }
        );
        child.on(
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
        const child = run_child(script_filename);
        child.on("spawn", () => {
          child.stdout?.pipe(process.stdout);
          child.stderr?.pipe(process.stderr);
        });
        child.on(
          "message",
          ({
            data,
            ...query
          }: {
            data: any;
            ttl?: number;
            priority?: number;
            delay?: number;
            dedup?: boolean;
            uid?: string;
          }) => {
            call_api({
              server_address: server,
              pathname: `/mq/${channel}`,
              query,
              payload: data,
            });
          }
        );
      }
    );
};
