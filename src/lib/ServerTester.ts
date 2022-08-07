import { call_api } from "../callApi";
import ora from "ora";

export class ServerTester {
  private time = Infinity;
  private latest_call = 0;

  constructor(private readonly server_address: string) {}

  async try_ready() {
    const spinner = ora();
    spinner.start("server connecting...");
    await this.ping();
    spinner.succeed("server ready");
  }

  private pingP = null as null | Promise<number>;
  async ping() {
    const { latest_call, time, server_address, pingP } = this;
    if (Date.now() - latest_call <= 5 * 1000 * 60) {
      return time;
    }
    if (pingP) {
      return pingP;
    }
    let resolve: any = () => {};
    let reject: any = () => {};
    this.pingP = new Promise((res, rej) => [(resolve = res), (reject = rej)]);
    const start_time = Date.now();
    this.latest_call = start_time;
    const { body } = await call_api({
      server_address,
      pathname: "ping",
    });
    if (!body.toString().startsWith("pong")) {
      const err = new Error(`server error`);
      reject(err);
      throw err;
    }
    this.time = start_time - Date.now();
    resolve(this.time);
    return this.time;
  }
}
