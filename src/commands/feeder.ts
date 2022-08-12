import "esm-hook";

import { Command } from "commander";
import { EventEmitter } from "eventemitter3";
import got from "got";
import { HttpsProxyAgent } from "hpagent";

import { Update } from "typegram";
import { wait } from "./misc";
import ora from "ora";
import { call_api } from "../callApi";
import { urlJoin } from "../urlJoin";
import { ServerTester } from "../lib/ServerTester";

const base_url = decodeURIComponent(
  Buffer.from("aHR0cHMlM0EvL2FwaS50ZWxlZ3JhbS5vcmcvYm90", "base64").toString()
);
const method_url = (token: string, method: string) =>
  `${base_url}${token}/${method}`;

class TGBotFeeder {
  bus = new EventEmitter<{
    updates: (updates: Update[]) => void;
  }>();

  private spinner = ora();

  private offset = 0;
  private agent?: HttpsProxyAgent;

  constructor(readonly token: string, proxy?: string) {
    if (proxy) {
      this.agent = new HttpsProxyAgent({
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: 256,
        maxFreeSockets: 256,
        scheduling: "lifo",
        proxy,
      });
    }
  }

  private method_url(method: string) {
    return method_url(this.token, method);
  }

  private call_api(method: string, payload?: Record<string, any>) {
    return got(this.method_url(method), {
      method: "POST",
      agent: {
        https: this.agent,
      },
      headers: {
        "content-type": "application/json",
        connection: "keep-alive",
      },
      body: JSON.stringify(payload),
    });
  }

  async get_me() {
    this.spinner.start("try getMe");
    const resp = await this.call_api("getMe");
    const { ok, result } = JSON.parse(resp.body);
    if (ok) {
      this.spinner.succeed("bot service ok, get data:");
      console.log(result);
    } else {
      this.spinner.fail(`get statusCode: ${resp.statusCode}`);
      process.exit(1);
    }
  }

  async fetch_updates(): Promise<Update[]> {
    const { offset } = this;
    const resp = await this.call_api("getUpdates", { timeout: 30, offset });
    const { ok, result } = JSON.parse(resp.body) || {};
    if (!ok) {
      return [];
    }
    if (Array.isArray(result) && result.length) {
      const last = result[result.length - 1] as Update;
      this.offset = last.update_id + 1;
    }
    return result;
  }

  async fetch_forever() {
    let done = false;
    while (!done) {
      try {
        const updates = await this.fetch_updates();
        if (updates.length) {
          this.bus.emit("updates", updates);
          this.log_updates(updates);
        }
        await wait(1);
      } catch (error) {
        console.log(`[err]`, (error as any).message);
        await wait(1000);
      }
    }
  }

  log_updates(updates: Update[]) {
    const count = {} as Record<string, number>;
    updates.forEach((update) =>
      Object.keys(update).forEach((k) => {
        count[k] ||= 0;
        count[k] += 1;
      })
    );
    console.log("[updates]", JSON.stringify(count));
  }
}

class MQPusher {
  constructor(
    readonly server_address: string,
    readonly channel: string,
    readonly autoack?: boolean,
    readonly ttl_ms?: number
  ) {}

  async push_updates(updates: any[]) {
    for (const update of updates) {
      await this.push_update(update);
    }
  }

  async push_update(update: any, retry_times = 0) {
    if (retry_times >= 8) {
      console.log("[retry:max]", "retry max");
      process.exit(1);
    }
    const { server_address, channel, autoack, ttl_ms } = this;
    try {
      const resp = await call_api({
        server_address,
        pathname: urlJoin("mq", channel),
        query: {
          ack: autoack,
          ttl: ttl_ms,
        },
        payload: update,
      });
      const { statusCode = 200, statusMessage } = resp.response;
      if (statusCode < 200 || statusCode >= 400) {
        console.error(`[push]`, statusCode, statusMessage || "server error");
      }
    } catch (error) {
      console.log(`[feeder:err]error:`);
      console.log("\t", (error as any)?.message || error);
      const tester = new ServerTester(server_address);
      await tester.test_forever();
      await this.push_update(update, retry_times + 1);
    }
  }
}

const TOKEN_REG = /[0-9]{9}:[a-zA-Z0-9_-]{35}/g;

export const install_feeder_command = (program: Command) => {
  program
    .command("feeder")
    .description("feed tg bot-updates to MQ")
    .option("-T, --token <string>", "bot token")
    .option("-s, --server [address]", "server address", "localhost:9292")
    .option("-c, --channel <name>", "mq namespace")
    .option("-a, --ack", "auto ack when message fetched")
    .option("-x, --proxy [address]", "http proxy for request")
    .option("-t, --ttl [second]", "message default ttl (s)", "900")
    .action(
      async ({
        token,
        server,
        channel,
        ack,
        proxy,
        ttl,
      }: {
        token: string;
        server: string;
        channel: string;
        ack: boolean;
        proxy?: string;
        ttl: string;
      }) => {
        if (!TOKEN_REG.test(token)) {
          console.log(
            `token format is not legal, please check if it is correct`
          );
          process.exit(1);
        }
        if (!channel) {
          console.log(`channel name be required, but get empty`);
          process.exit(1);
        }

        let ttl_ms = undefined as undefined | number;
        if (ttl !== undefined) {
          if (Number.isNaN(Number(ttl))) {
            console.log(`The parameter ttl must be a number, but got ${ttl}`);
            process.exit(1);
          }
          ttl_ms = Number(ttl) * 1000;
        }

        const tester = new ServerTester(server);
        await tester.try_ready();

        const feeder = new TGBotFeeder(token, proxy);
        const pusher = new MQPusher(server, channel, ack, ttl_ms);

        await feeder.get_me();
        feeder.bus.on("updates", pusher.push_updates.bind(pusher));
        feeder.fetch_forever();
      }
    );
};
