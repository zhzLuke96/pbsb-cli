import { Command } from "commander";
import { createReadStream, existsSync, statSync } from "fs";
import { parse } from "path";
import { call } from "../callApi";
import { packageJson } from "../utils";

import { to_abs_filepath, watch_file } from "./misc";
import mime from 'mime-types';

const push_file = async (
  filepath: string,
  {
    server,
    channel,
    cache,
    multicast,
  }: { server: string; channel: string; cache: boolean; multicast: boolean }
) => {
  if (!existsSync(filepath)) {
    throw new Error(`No such file of ${filepath}`);
  }
  if (statSync(filepath).isDirectory()) {
    throw new Error(`No such file of ${filepath}`);
  }
  const fd = createReadStream(filepath);
  const { base: basename } = parse(filepath);
  const stat = statSync(filepath);
  const { req, resp } = await call({
    method: "POST",
    server_address: server,
    pathname: channel,
    query: {
      cache,
      multicast,
    },
    headers: {
      "pb-cli-share-filename": basename,
      "pb-cli-method": "share",
      "pb-cli-version": packageJson.version,
      "content-type": mime.lookup(basename),
      "content-length": stat.size
    },
  });
  fd.pipe(req, { end: true });
  req.on('end', () => {
    if (!fd.closed) {
      fd.close();
    }
  })
  // TODO 判断 response 返回状态提示有没有成功
};

export const install_share_command = (program: Command) => {
  program
    .command("share")
    .description("share file")
    .argument("<filepath>", "filepath of file to be share")
    .option(
      "-w, --watch",
      "watch file changes and send a new file for each change"
    )
    .requiredOption("-c, --channel <name>", "channel name")
    .option("-s, --server [address]", "server address", "localhost:9292")
    .option("-m, --multicast", "message multicast", true)
    .option("-c, --cache", "message cache", false)
    .action(
      async (
        filename: string,
        {
          watch,
          channel,
          server,
          multicast,
          cache,
        }: {
          watch: boolean;
          channel: string;
          server: string;
          multicast: boolean;
          cache: boolean;
        }
      ) => {
        const filepath = to_abs_filepath(filename);

        const push_once = () => push_file(filepath, { server, channel, multicast, cache })

        await push_once();

        if (watch) {
          watch_file(filepath, push_once, () =>
            console.log("[share]", "file is updated, but content not changed")
          );
        }
      }
    );
};
