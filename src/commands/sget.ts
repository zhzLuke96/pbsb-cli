import { exec } from "child_process";
import { Command } from "commander";
import { createWriteStream } from "fs";
import { parse } from "path";
import { call } from "../callApi";
import { to_abs_filepath, wait } from "./misc";

const pull_file = async ({
  server,
  channel,
  output,
}: {
  server: string;
  channel: string;
  output?: string;
}) => {
  const { req, resp } = await call({
    server_address: server,
    pathname: channel,
    method: "GET",
  });
  req.end();
  const { response } = await resp;

  const { base: chname } = parse(channel);
  const rawname = String(response.headers["pb-cli-share-filename"]);
  const filepath = to_abs_filepath(output || rawname || chname);

  // 避免文件长时间占用 只在有数据流的时候才建立stream
  response.once("data", (data) => {
    const fd = createWriteStream(filepath);
    fd.write(data);
    response.pipe(fd, { end: true });
    response.once("end", () => {
      if (!fd.closed) {
        fd.close();
      }
    });
  });
};

const retry_forever = async (
  fn: () => Promise<any>,
  interval_ms: number,
  max_retries: number
) => {
  let retries = 0;
  let latest_err: any = new Error("unknow error");
  while (retries < max_retries) {
    try {
      await fn();
    } catch (error) {
      latest_err = error;
    } finally {
      await wait(interval_ms);
    }
  }
  throw latest_err;
};

const valid_number = (n: number | string) => {
  const num = Number(n);
  if (Number.isNaN(num)) {
    throw new Error(`${n} is not valid number`);
  }
  return num;
};

export const install_sget_command = (program: Command) => {
  program
    .command("sget")
    .description("download files by subscribing channel (like wget)")
    .option("-c, --channel <name>", "channel name")
    .option("-s, --server [address]", "server address", "localhost:9292")
    .option("-o, --output [filename]", "write to file instead of stdout")
    .option("-w, --watch", "watch channel and downloading the latest file")
    .option("-i, --interval [ms]", "interval of each request", "1000")
    .option(
      "-r, --retry [number]",
      "maximum number of retries in case of request errors",
      "10"
    )
    .option(
      "-S, --shell [string]",
      "a shell script will be executed after the file is changed"
    )
    .action(
      async ({
        server,
        channel,
        output,
        watch,
        interval,
        retry,
        shell,
      }: {
        server: string;
        channel: string;
        output?: string;
        watch: boolean;
        interval: string;
        retry: string;
        shell?: string;
      }) => {
        const pull_once = async () => {
          await pull_file({ server, channel, output });
          if (shell) {
            const child = exec(shell);
            child.stdout?.pipe(process.stdout);
            child.stderr?.pipe(process.stderr);
          }
        };
        if (watch) {
          retry_forever(pull_once, valid_number(interval), valid_number(retry));
        } else {
          pull_once();
        }
      }
    );
};
