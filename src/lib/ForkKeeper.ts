import path from "path";
import { existsSync } from "fs";
import { ChildProcess, fork } from "child_process";
import { EventEmitter } from "eventemitter3";
import { wait } from "../commands/misc";

const filepath_valid = (filepath: string) => {
  const pth = path.isAbsolute(filepath)
    ? filepath
    : path.join(process.cwd(), filepath);
  if (!existsSync(pth)) {
    throw new Error(`cant find file from: ${pth}`);
  }
  return pth;
};

// keep child process running
export class ForkKeeper<
  DATA = any,
  SEND_DATA extends Record<string, any> = Record<string, any>
> extends EventEmitter<{
  message: (data: DATA) => any;
  error: (err?: any) => any;
}> {
  child_process?: ChildProcess;
  filepath: string;

  constructor(filepath: string, readonly max_retries = 10) {
    super();
    this.filepath = filepath_valid(filepath);
    const { ext } = path.parse(filepath);
    if (ext !== ".js") {
      throw new Error(`[${ext}] type of script is not supported`);
    }

    this.try_fork();
  }

  send(data: SEND_DATA) {
    if (!this.child_process) {
      console.warn(`[fork]`, "not found child_process");
      return;
    }
    this.child_process.send(data);
  }

  /**
   * send data and wait recv
   */
  send_recv(data: SEND_DATA, send_timeout_ms = 5 * 1000 * 60) {
    if (!this.child_process) {
      throw new Error(`[fork]not found child_process`);
    }
    const _ipc_id = Math.random().toString(36).slice(2);
    this.child_process.send({ ...data, _ipc_id });
    return new Promise<DATA>((resolve, reject) => {
      if (!this.child_process) {
        reject(new Error("[fork:err]unknown error"));
        return;
      }
      let timeout_timer = null as null | NodeJS.Timeout;
      const handler = (message: Record<string, any>) => {
        const done = () => {
          resolve(message as any);
          timeout_timer && clearTimeout(timeout_timer);
          this.child_process?.off("message", handler);
        };
        if (!("_ipc_id" in message) || message["_ipc_id"] === _ipc_id) {
          done();
        }
      };
      this.child_process.on("message", handler);
      timeout_timer = setTimeout(() => {
        reject(new Error("[fork:err]send timeout"));
        this.child_process?.off("message", handler);
      }, send_timeout_ms); // default 5min
    });
  }

  retry_count = 0;
  private async try_fork() {
    this.retry_count += 1;
    if (this.retry_count > this.max_retries) {
      throw new Error(
        `subroutine terminates abnormally and retries exceeds the max_retries limit [${this.max_retries}]`
      );
    }
    try {
      this.child_process = await this.fork();

      this.child_process.stdout?.pipe(process.stdout);
      this.child_process.stderr?.pipe(process.stderr);

      this.child_process.on("message", (message) =>
        this.emit("message", message as DATA)
      );
      this.child_process.once("disconnect", () => {
        this.child_process?.removeAllListeners();
        if (!this.child_process?.killed) {
          this.child_process?.kill();
        }
        this.try_fork();
      });
      this.child_process.once("exit", () => {
        this.child_process?.removeAllListeners();
        if (!this.child_process?.killed) {
          this.child_process?.kill();
        }
        this.try_fork();
      });
    } catch (error) {
      this.emit("error", error);
      console.log(`[fork:err]`, (error as any).message);
      await wait(300);
      console.log(`retry fork again, retry times: ${this.retry_count}`);
    }
  }

  private fork() {
    return new Promise<ChildProcess>((resolve, reject) => {
      const ret = fork(this.filepath);
      ret.once("spawn", () => resolve(ret));
      ret.once("error", reject);
    });
  }
}
