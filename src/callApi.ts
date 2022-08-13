import * as https from "https";
import * as http from "http";

function serialize(obj: Record<string, any>, prefix?: string) {
  const strs = [] as string[];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) {
      continue;
    }
    // pbsb 内部规则
    const value = typeof v !== "boolean" ? v : v ? 1 : 0;
    const key = prefix ? prefix + "[" + k + "]" : k;
    strs.push(
      v !== null && typeof v === "object"
        ? serialize(v, key)
        : encodeURIComponent(key) + "=" + encodeURIComponent(value)
    );
  }
  return strs.join("&");
}

const createURL = (url: string, protocol: "http" | "https") => {
  try {
    const ret = new URL(url);
    if (!ret.protocol.startsWith("http")) {
      throw new Error(`not support protocol ${ret.protocol}`);
    }
    return ret;
  } catch (error) {
    // noop
  }
  try {
    const ret = new URL(`${protocol}://${url}`);
    return ret;
  } catch (error) {
    // noop
  }
  throw new Error("create url fail");
};

const url_with_query = (url: string | URL, query?: Record<string, any>) => {
  const tURL = url instanceof URL ? url : createURL(url, 'https');
  if (query) {
    tURL.search = serialize(query);
  }
  return tURL;
};

export const call = async ({
  pathname,
  server_address,
  method,
  query,
  headers,
  on_data,
}: {
  pathname: string;
  server_address: string;
  query?: Record<string, any>;
  method?: string;
  headers?: Record<string, any>;
  on_data?: (data: Buffer) => any;
}) => {
  const base_url = await ensure_base_url(server_address);
  const url = new URL(base_url);
  url.pathname = pathname;

  let resolve!: (x: any) => any;
  let reject!: (x: any) => any;
  let resp = new Promise<{ response: http.IncomingMessage }>((re, rj) => [
    (resolve = re),
    (reject = rj),
  ]);
  const req_url = url_with_query(url, query);
  const req = (url.protocol === "https:" ? https : http).request(
    req_url,
    {
      rejectUnauthorized: false,
      // requestCert: true,
      agent: false,
      method,
      headers,
    },
    (res) => {
      resolve({ response: res });
      res.on("error", reject);
    }
  );
  req.on("error", reject);
  return {
    req,
    resp,
    body: () =>
      new Promise<Buffer>(async (resolve, reject) => {
        const { response } = await resp;
        const datas = [] as Buffer[];
        response.on("data", (data) => {
          datas.push(Buffer.from(data));
          on_data?.(data);
        });
        response.on("end", () => {
          resolve(Buffer.concat(datas));
        });
        response.on("error", reject);
      }),
  };
};

export const fetch = ({
  url,
  payload,
  query,
  on_data,
  headers,
}: {
  url: string;
  payload?: string | Record<string, any>;
  query?: Record<string, any>;
  headers?: Record<string, any>;
  on_data?: (data: Buffer) => any;
}) =>
  new Promise<{ response: http.IncomingMessage; body: Buffer }>(
    (resolve, reject) => {
      const req_url = url_with_query(url, query);
      const req = (url.startsWith("https://") ? https : http).request(
        req_url,
        {
          rejectUnauthorized: false,
          // requestCert: true,
          agent: false,
          method: payload ? "POST" : "GET",
          headers: payload
            ? {
                ...headers,
                "content-type": "application/json",
                connection: "keep-alive",
              }
            : { ...headers },
        },
        (res) => {
          const datas = [] as Buffer[];
          res.on("data", (data) => {
            datas.push(Buffer.from(data));
            on_data?.(data);
          });
          res.on("end", () => {
            resolve({ response: res, body: Buffer.concat(datas) });
          });
          res.on("error", reject);
        }
      );
      req.on("error", reject);
      if (payload) {
        if (typeof payload === "object") {
          req.write(
            JSON.stringify(payload, (_, value) => {
              if (value == null) return undefined;
              return value;
            })
          );
        } else {
          req.write(payload);
        }
      }
      req.end();
    }
  );

export const fetch_json = <RET = unknown>(params: {
  url: string;
  payload?: string | Record<string, any>;
  query?: Record<string, any>;
  headers?: Record<string, any>;
  on_data?: (data: Buffer) => any;
}) =>
  fetch(params).then((resp) => {
    const ret = resp as {
      response: http.IncomingMessage;
      body: any;
    };
    try {
      ret.body = JSON.parse(resp.body.toString("utf-8") || "{}") as RET;
    } catch (error) {}
    return ret;
  });

let is_https = null as null | boolean;
const ensure_base_url = async (uri: string) => {
  if (is_https == true) {
    return createURL(uri, "https");
  } else if (is_https === false) {
    return createURL(uri, "http");
  }

  // *优先test https，因为主服务兼容http和https双协议，http也有重定向返回，但是不可用
  const url = createURL(uri, 'https');
  url.pathname = "/ping";
  const try_once = async () => {
    try {
      const { body } = await fetch({ url: url.toString() });
      if (body.toString() === "pong") {
        if (url.protocol.startsWith("https")) {
          is_https = true;
        } else {
          is_https = false;
        }
      }
      return url;
    } catch (error) {
      // noop
    }
  };
  {
    let ret = await try_once();
    if (ret) {
      ret.pathname = "";
      return ret;
    }
  }
  if (url.protocol.startsWith("https")) {
    url.protocol = "http:";
  } else {
    url.protocol = "https:";
  }
  {
    let ret = await try_once();
    if (ret) {
      ret.pathname = "";
      return ret;
    }
  }
  throw new Error("Cannot connect to server");
};
export const call_api = async ({
  server_address,
  pathname,
  payload,
  query,
  headers,
  on_data,
}: {
  server_address: string;
  pathname: string;
  payload?: string | Record<string, any>;
  query?: Record<string, any>;
  headers?: Record<string, any>;
  on_data?: (data: Buffer) => any;
}) => {
  const base_url = await ensure_base_url(server_address);
  const url = new URL(base_url);
  url.pathname = pathname;
  return fetch({ url: url.toString(), payload, query, on_data, headers });
};
export const call_api_json = async ({
  server_address,
  pathname,
  payload,
  query,
  headers,
}: {
  server_address: string;
  pathname: string;
  payload?: string | Record<string, any>;
  query?: Record<string, any>;
  headers?: Record<string, any>;
}) => {
  const base_url = await ensure_base_url(server_address);
  const url = new URL(base_url);
  url.pathname = pathname;
  return fetch_json({ url: url.toString(), payload, query, headers });
};
