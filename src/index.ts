import "esm-hook";

import { Command } from "commander";

import { packageJson } from "./utils";

import { install_call_command } from "./commands/call";
import { install_chat_command } from "./commands/chat";
import { install_host_command } from "./commands/host";
import { install_consume_command } from "./commands/consume";
import { install_produce_command } from './commands/produce';
import { install_pubsub_command } from "./commands/pubsub";
import { install_reqres_command } from "./commands/reqres";
import { install_sget_command } from "./commands/sget";
import { install_share_command } from "./commands/share";
import { install_tg_feeder_command } from './commands/tg/tg-feeder';
import { install_fastapi_command } from './commands/fastapi';


const program = new Command();

program
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version);

install_call_command(program);
install_pubsub_command(program);
install_reqres_command(program);
install_consume_command(program);
install_produce_command(program);
install_share_command(program);
install_sget_command(program);
install_chat_command(program);
install_host_command(program);
install_fastapi_command(program);

// TG
install_tg_feeder_command(program);

program.parse(process.argv);

process
  .on("unhandledRejection", (reason: any) => {
    console.error("[err:rej]", reason?.message || reason);
    console.error(reason);
    // TODO 某些报错可能需要直接退出
  })
  .on("uncaughtException", (reason: any) => {
    console.error("[err:exp]", reason?.message || reason);
    console.error(reason);
  });
