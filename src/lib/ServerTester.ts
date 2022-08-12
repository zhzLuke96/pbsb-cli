import { call_api } from "../callApi";
import ora from "ora";
import { wait } from "../commands/misc";

export class ServerTester {
  constructor(private readonly server_address: string) {}

  async try_ready() {
    const spinner = ora();
    while (1) {
      spinner.start("server connecting...");
      try {
        const time = await this.ping();
        spinner.succeed(`Server Connected, Response Delay ${time}ms`);
        return;
      } catch (error) {
        spinner.fail("server connect error, retry again after 1s");
        console.error("[test]error:", "\t", (error as any)?.message || error);
        await wait(1000);
        continue;
      }
    }
  }

  async test_forever() {
    const spinner = ora();
    while (1) {
      spinner.start("server connecting again...");
      try {
        const time = await this.ping();
        spinner.succeed(`Server Ready Again~ Response Delay ${time}ms`);
        return;
      } catch (error) {
        spinner.fail("server connect error, retry again after 1s");
        console.error("[test]error:", "\t", (error as any)?.message || error);
        await wait(1000);
        continue;
      }
    }
  }

  async ping() {
    const { server_address } = this;
    const { body, response } = await call_api({
      server_address,
      pathname: "ping",
      headers: {
        "pb-ts": Date.now(),
      },
    });
    const body_str = body.toString();
    if (!body_str.startsWith("pong")) {
      const err = new Error(`server error, should pong, but ${body_str}`);
      throw err;
    }
    return Number(response.headers["pb-time"]);
  }
}
