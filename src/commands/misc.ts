import { isAbsolute, join } from "path";
import { call_api } from "../callApi";

import fs from "fs";
import crypto from "crypto";
import { promisify } from "util";
import node_watch from "node-watch";

export const call_api_and_print = async ({
  server,
  pathname,
  json,
  payload,
  query,
  headers,
}: {
  server: string;
  pathname: string;
  json?: boolean;
  payload?: string | Record<string, any>;
  query?: string | Record<string, any>;
  headers?: Record<string, any>;
}) => {
  const safe_parse = (obj?: string | Record<string, any>) => {
    if (!obj) {
      return undefined;
    }
    if (typeof obj === "object") {
      return obj;
    }
    try {
      return JSON.parse(obj);
    } catch (error) {
      // noop
    }
    return obj;
  };
  const resp = await call_api({
    server_address: server,
    pathname,
    query: safe_parse(query),
    payload: safe_parse(payload),
    headers,
  });
  let text = resp.body.toString();
  if (json) {
    try {
      const jsondata = JSON.parse(resp.body.toString());
      text = JSON.stringify(jsondata, null, 2);
    } catch (error) {
      // noop
    }
  }
  console.log(text);
};

const cwd = process.cwd();
export const to_abs_filepath = (filename: string) => {
  if (isAbsolute(filename)) {
    return filename;
  }
  return join(cwd, filename);
};

export const wait = promisify(setTimeout);

const read_file_partial = (filepath: string, start?: number, end?: number) => {
  return new Promise<Buffer>((resolve, reject) => {
    const fd = fs.createReadStream(filepath, { start, end });
    const buffer = [] as Buffer[];
    fd.on("data", (chunk: Buffer) => {
      buffer.push(chunk);
    });
    fd.on("error", reject);
    const end_cb = () => {
      resolve(Buffer.concat(buffer));
    };
    fd.on("end", end_cb);
    fd.on("close", end_cb);
  });
};

const get_quick_md5 = async (filepath: string) => {
  const hash = crypto.createHash("md5");
  const stat = fs.statSync(filepath);
  const filesize = stat.size;
  const chunksize = 2097152; // 2mb
  const chunks = Math.ceil(filesize / chunksize);
  const chunkidxs = Array.from(new Set([0, Math.floor(chunks / 2), chunks]));

  const buffer = await Promise.all(
    chunkidxs.map((idx) =>
      read_file_partial(filepath, idx * chunksize, (idx + 1) * chunksize)
    )
  );
  hash.update(Buffer.concat(buffer));
  return hash.digest("hex");
};

export const watch_file = (filepath: string, callback: () => void, unchange?: () => void) => {
  let pre_md5 = null as null | string;
  const watcher = node_watch(filepath, {}, async (evt, _) => {
    switch (evt) {
      case "remove": {
        // file remove
        return;
      }
      case "update": {
        const cur_md5 = await get_quick_md5(filepath);
        if (cur_md5 !== pre_md5) {
          callback();
          pre_md5 = cur_md5;
        } else {
          unchange?.();
        }
        return;
      }
    }
  });
  watcher.on("error", (error) => {
    console.log(`[watcher]`, error.message);
  });
};

export const valid_pubsub_channel = (channel: string) => {
  const chan = channel[0] === "/" ? channel.slice(1) : channel;
  const invalid_prefix = ["mq", "recv", "res", "req"];
  for (const prefix of invalid_prefix) {
    if (chan.startsWith(prefix)) {
      throw new Error(
        `channel name is invalid, prefix not should be [${prefix}]`
      );
    }
  }
};
