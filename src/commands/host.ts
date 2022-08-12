import { Command } from "commander";
import { parse } from "path";
import { call, call_api } from "../callApi";
import { urlJoin } from "../urlJoin";
import { to_abs_filepath, wait } from "./misc";
import { ForkKeeper } from "../lib/ForkKeeper";
import { ServerTester } from "../lib/ServerTester";

interface PbHTTPReq {
  method: string;
  uri: string;
  body: Buffer;
  recv_id: string;
  headers?: Record<string, any>;
}
interface PbHTTPRes {
  recv_id: string;
  headers?: Record<string, any>;
  body?: Buffer;
}

class LoopArray<T> {
  private idx = -1;
  private arr = [] as T[];

  push(v: T) {
    this.arr.push(v);
  }

  next(): T | undefined {
    let cur = (this.idx + 1) % this.arr.length;
    return this.arr[cur] || this.arr[0];
  }
}

class HostSev {
  instances = new LoopArray<ForkKeeper<PbHTTPReq, PbHTTPRes>>();

  destroyed = false;

  constructor(
    readonly filepath: string,
    readonly server_address: string,
    readonly router: string,
    readonly instance = 1
  ) {
    const { ext } = parse(filepath);
    if (ext !== ".js") {
      throw new Error(`[${ext}] type of scripts not supported`);
    }
    for (let idx = 0; idx < instance; idx++) {
      const child = new ForkKeeper(filepath);
      this.instances.push(child);

      child.on("message", (data) => {
        // TODO PbHTTPRes type check
        this.recv(data as any);
      });
    }

    this.initalize();
  }

  async initalize() {
    this.lisent_router();
  }

  async lisent_router() {
    const { server_address, router } = this;
    while (!this.destroyed) {
      // TODO timeout
      try {
        const resp = await call_api({
          server_address,
          pathname: urlJoin("res", router),
        });
        let method = "GET";
        let recv_id = "";
        let uri = "";
        const headers = {} as Record<string, any>;
        for (const [k, v] of Object.entries(resp.response.headers)) {
          if (k.startsWith("pb-h-")) {
            headers[k.slice("pb-h-".length)] = v;
          } else if (k === "pb-method") {
            method = String(v);
          } else if (k === "pb-recv-id") {
            recv_id = String(v);
          } else if (k === "pb-uri") {
            uri = String(v);
          }
        }
        this.reqt({
          method,
          recv_id,
          uri,
          headers,
          body: resp.body,
        });
      } catch (error) {
        console.log(`[host:err]error:`);
        console.log("\t", (error as any)?.message || error);
        const tester = new ServerTester(server_address);
        await tester.test_forever();
      }
    }
  }

  async reqt(pbreq: PbHTTPReq) {
    const child = this.instances.next();
    if (!child) {
      // TODO ERROR
      return;
    }
    child.send(pbreq);
  }

  async recv(pbres: PbHTTPRes) {
    const { server_address } = this;
    const headers = Object.fromEntries(
      Object.entries(pbres.headers || {})
        .filter(([k]) => k.startsWith("pb-h-"))
        .map(([k, v]) => [k.slice("pb-h-".length), v])
    );

    // TODO retry / headers / statusCode
    const { req } = await call({
      server_address,
      pathname: `recv/${pbres.recv_id}`,
      headers,
      method: "POST",
    });
    req.write(pbres.body);
    req.end();
  }
}

export const install_host_command = (program: Command) => {
  // TODO logger
  program
    .command("host")
    .description("host http server based on script")
    .argument("<filename>", "server script filename")
    .option("-s, --server [address]", "server address", "localhost:9292")
    .requiredOption("-r, --router <string>", "host router")
    .option("-i, --instance [number]", "instance number", "1")
    .action(
      async (
        filename: string,
        {
          server,
          router,
          instance,
        }: { server: string; router: string; instance: number }
      ) => {
        const instN = Number(instance);
        if (Number.isNaN(instN)) {
          console.log(
            "[host]",
            `instance number must be number, but got ${instance}`
          );
          return;
        }
        const tester = new ServerTester(server);
        await tester.try_ready();

        const sev = new HostSev(
          to_abs_filepath(filename),
          server,
          router,
          Number(instance)
        );
        // TODO error catch
      }
    );
};
