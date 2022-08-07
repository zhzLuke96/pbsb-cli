import { Command } from "commander";

import os from "os";
import { call_api } from "../callApi";
import { to_abs_filepath, valid_pubsub_channel } from "./misc";

import EventEmitter from "eventemitter3";
import ora from "ora";
import readline from "readline";
import { promisify } from "util";

import LRUCache from "lru-cache";
import { ForkKeeper } from "../lib/ForkKeeper";

const default_username = () => {
  const username = os.userInfo().username;
  return `${username}-${Math.random().toString(36).slice(2, 4)}`;
};

type CodecsPayload = {
  type: "encode" | "decode";
  text: string;
  sig?: string;
};
type CodecsKeeper = ForkKeeper<
  { result: string } & CodecsPayload,
  CodecsPayload
>;

class ChatCodecs {
  cache = new LRUCache<string, string>({
    max: 512,
    maxSize: 1024,
    ttl: 1000 * 60 * 30, // 30min
    sizeCalculation: () => 1,
  });
  keeper?: CodecsKeeper;

  constructor(readonly sig?: string, readonly filepath?: string) {
    if (filepath) {
      this.keeper = new ForkKeeper(filepath);
    }
  }

  async keeper_process({
    type,
    text,
    keeper,
    sig,
  }: {
    type: CodecsPayload["type"];
    text: string;
    keeper: CodecsKeeper;
    sig?: string;
  }) {
    if (this.cache.has(text)) {
      return this.cache.get(text)!;
    }
    const { result } = await keeper.send_recv({
      type,
      text,
      sig,
    });
    if (result) {
      this.cache.set(text, result);
    }
    return result;
  }

  async encode(message: string) {
    if (!this.keeper) {
      return message;
    }
    return this.keeper_process({
      text: message,
      sig: this.sig,
      keeper: this.keeper,
      type: "encode",
    });
  }

  async decode(message: string, sig?: string) {
    if (!this.keeper) {
      return message;
    }
    return this.keeper_process({
      text: message,
      sig: sig,
      keeper: this.keeper,
      type: "decode",
    });
  }
}

class ChatSev extends EventEmitter<{
  message: (msg: { text: string; name: string }) => any;
  error: (err: any) => any;
}> {
  codecs: ChatCodecs;
  username!: string;

  constructor(
    readonly server_address: string,
    readonly pathname: string,
    username?: string,
    readonly sig?: string,
    readonly codecs_filename?: string
  ) {
    super();
    this.codecs = new ChatCodecs(
      sig,
      codecs_filename ? to_abs_filepath(codecs_filename) : undefined
    );

    this.initalize(username);
  }

  async initalize(username?: string) {
    this.username = await this.codecs.encode(username || default_username());
    const spinner = ora();
    spinner.start("Testing server availability");
    const { ok } = await this.test_server();
    if (!ok) {
      spinner.fail("Unable connect server");
      this.emit("error", new Error("Unable connect server"));
      return;
    }
    spinner.succeed("server ready");

    this.connect();
    process.stdin.removeAllListeners("data");

    this.initalize_repl();
  }

  async initalize_repl() {
    const { codecs } = this;
    this.on("message", ({ name, text }) => {
      if (name === this.username) {
        return;
      }
      process.stdout.write(
        `\r${codecs.decode(name)}> ${codecs.decode(text)}\r\nyou> `
      );
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const qustion = promisify(rl.question).bind(rl) as any as (
      x: string,
      p?: { signal: AbortSignal }
    ) => Promise<string>;
    while (1) {
      const message = (await qustion("you> ")).trim();
      if (message) {
        this.send_msg(await codecs.encode(message));
      }
    }
  }

  async test_server() {
    const { server_address } = this;
    const resp = await call_api({ server_address, pathname: "ping" });
    return {
      ok:
        resp.response.statusCode === 200 &&
        resp.body.toString().startsWith("pong"),
    };
  }

  async send_msg(msg: string) {
    const { server_address, pathname, username, sig, codecs } = this;
    const resp = await call_api({
      server_address,
      pathname,
      payload: {
        name: codecs.encode(username),
        msg: codecs.encode(msg),
        sig: sig,
      },
      query: {
        multicast: true,
        drop: true,
      },
    });
    // TODO check resp status
  }

  async connect() {
    const { server_address, pathname, codecs } = this;

    try {
      await call_api({
        server_address,
        pathname,
        query: {
          persist: true,
        },
        on_data: async (data) => {
          const jsonData = JSON.parse(data.toString());
          this.emit("message", {
            text: await codecs.decode(jsonData.msg, jsonData.sig),
            name: await codecs.decode(jsonData.name, jsonData.sig),
          });
        },
      });
    } catch (error) {
      console.log("[chat:err]", (error as any)?.message);
    } finally {
      console.log("[chat]server disconnect");
    }
  }
}

export const install_chat_command = (program: Command) => {
  program
    .command("chat")
    .description("simple chat via channels")
    .argument("<channel>", "channel path")
    .option("-u, --username [string]", "chat username")
    .option("-s, --server [address]", "server address", "localhost:9292")
    .option("-c, --codecs [string]", "chat message codecs")
    .action(
      async (
        channel: string,
        {
          server,
          username,
          sig,
          codecs,
        }: { username: string; server: string; sig: string; codecs: string }
      ) => {
        valid_pubsub_channel(channel);
        const chatSev = new ChatSev(server, channel, username, sig, codecs);

        chatSev.on("error", (err) => {
          console.log(`[chat]`, err.message);
        });
      }
    );
};
