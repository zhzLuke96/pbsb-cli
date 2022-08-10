import { Command } from "commander";
import { IncomingMessage } from "http";
import { call } from "../callApi";
import { ForkKeeper } from "../lib/ForkKeeper";
import { urlJoin } from "../urlJoin";

import statuses from "statuses";
import { wait } from "./misc";
import { ServerTester } from "../lib/ServerTester";

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

type ApiPayload = {
  headers: Record<string, any>;
  body: Record<string, any>;
  query: Record<string, any>;
  method: string;
  recv_id: string;
};

type ApiErrResponse = {
  ok: false;
  error: string; // the http error message
  message: string; // the user error message
  status_code: number; // the http status code
};
type ApiOkResponse = {
  result: any;
  ok: true;
};
type ApiResponse = ApiErrResponse | ApiOkResponse;

type ApiRecv = {
  headers?: Record<string, any>;
  result?: Record<string, any>;

  error?: string;
  message?: string;
  status_code?: number | string;
};

class FastapiService {
  keepers = new LoopArray<ForkKeeper<ApiRecv, ApiPayload>>();

  constructor(
    readonly server_address: string,
    readonly channel: string,
    readonly filepath: string,
    instance: number
  ) {
    const instN = Math.max(1, instance);
    for (let idx = 0; idx < instN; idx++) {
      this.keepers.push(new ForkKeeper(filepath));
    }
  }

  private req_to_apireq(
    req: IncomingMessage,
    body: Record<string, any>
  ): ApiPayload {
    let method = "GET";
    let recv_id = "";
    let uri = "";
    const headers = {} as Record<string, any>;
    for (const [k, v] of Object.entries(req.headers)) {
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

    const url = new URL(uri, `http://${headers.host}`);
    const query = Object.fromEntries(url.searchParams.entries()) as Record<
      string,
      any
    >;

    return {
      headers,
      body,
      query,
      method,
      recv_id,
    };
  }

  private async call(payload: ApiPayload) {
    const instance = this.keepers.next();
    if (!instance) {
      console.warn("[fastapi]", "instance broke");
      return;
    }
    const ret = await instance.send_recv(payload);
    return ret;
  }

  async run_forever() {
    const { server_address, channel } = this;
    let done = false;
    while (!done) {
      let timeout = false;
      try {
        const { req, resp, body } = await call({
          server_address,
          pathname: urlJoin("res", channel),
        });

        req.end();
        const timer = setTimeout(() => {
          timeout = true;
          req.destroy();
        }, 30 * 1000); // timeout 30s
        const { response } = await resp;
        const resp_body = await body();
        clearTimeout(timer);

        let body_json = {} as any;
        try {
          body_json = JSON.parse(resp_body.toString());
        } catch (error) {
          const recv_id = String(response.headers["pb-recv-id"]);
          if (recv_id) {
            this.recv_err(recv_id, {
              code: 400,
              message: (error as any).message,
            });
            continue;
          }
        }

        const api_req = this.req_to_apireq(response, body_json);
        this.call_recv(api_req);
      } catch (error) {
        if (timeout) {
          continue;
        }
        console.error(`[fastapi:call_res]error:`);
        console.error((error as any)?.message || error);
        console.log("[fastapi:call_res]retry after 1s");
        await wait(1000);
      }
    }
  }

  private async recv(recv_id: string, data: ApiResponse, headers?: any) {
    const { server_address } = this;
    const { req, resp } = await call({
      server_address,
      pathname: `recv/${recv_id}`,
      method: "POST",
      headers: {
        ...headers,
        ...(data.ok ? {} : { "pb-status": data.status_code }),
      },
    });
    req.write(JSON.stringify(data));
    req.end();
    const { response } = await resp;
    return response;
  }

  private async recv_err(
    recv_id: string,
    { code = 500, message, error } = {} as {
      code?: string | number;
      message?: string;
      error?: string;
    }
  ) {
    return this.recv(recv_id, {
      error: error || statuses.message[Number(code)] || "",
      ok: false,
      message: message || "unknown error",
      status_code: Number(code) || 500,
    });
  }

  // TODO 处理call timeout情况
  private async call_recv(payload: ApiPayload) {
    const { recv_id } = payload;
    const recv = async (data: ApiResponse, headers?: any) =>
      this.recv(recv_id, data, headers);
    const recv_err = async (
      { code = 500, message, error } = {} as {
        code?: string | number;
        message?: string;
        error?: string;
      }
    ) =>
      recv({
        error: error || statuses.message[Number(code)] || "",
        ok: false,
        message: message || "unknown error",
        status_code: Number(code) || 500,
      });
    try {
      const ret = await this.call(payload);
      if (!ret) {
        await recv_err();
        return;
      }
      if (ret.error || ret.message) {
        await recv_err({
          error: ret.error,
          message: ret.message,
          code: ret.status_code,
        });
        return;
      }
      await recv(
        {
          ok: true,
          result: ret.result,
        },
        ret.headers
      );
      return;
    } catch (error) {
      console.log("[fastapi]error:");
      console.log((error as any)?.message || error);
      await recv_err();
    }
  }
}

export const install_fastapi_command = (program: Command) => {
  // TODO 增加call timeout配置
  // TODO logger 配置
  program
    .command("fastapi")
    .argument("<filepath>", "script filepath")
    .option("-s, --server [address]", "server address", "localhost:9292")
    .option("-c, --channel <name>", "api router path")
    .option("-i, --instance [number]", "fork instance number", "1")
    .action(
      async (
        filepath,
        {
          server,
          channel,
          instance,
        }: { server: string; channel: string; instance: string }
      ) => {
        const instN = Number(instance);
        if (Number.isNaN(instN)) {
          console.log(
            "[fastapi]",
            `instance number must be number, but got ${instance}`
          );
          return;
        }
        if (!channel) {
          console.log(
            "[fastapi]",
            `channel must be a string. Received ${channel}`
          );
          return;
        }
        const tester = new ServerTester(server);
        await tester.try_ready();

        const service = new FastapiService(server, channel, filepath, instN);
        service.run_forever();
      }
    );
};
