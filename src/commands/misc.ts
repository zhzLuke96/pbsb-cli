import { call_api } from "../callApi";

export const call_api_and_print = async (
  {
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
    query?: string |  Record<string, any>;
    headers?: Record<string, any>
  },
) => {
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
    headers
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
