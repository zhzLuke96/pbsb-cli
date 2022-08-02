import { Command } from "commander";

import packageJson from "../package.json";
import { install_call_command } from "./commands/call";
import { install_mq_command } from "./commands/mq";
import { install_pubsub_command } from "./commands/pubsub";
import { install_reqres_command } from "./commands/reqres";

const program = new Command();

program
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version);

install_call_command(program);
install_pubsub_command(program);
install_reqres_command(program);
install_mq_command(program);

program.parse(process.argv);

process
  .on("unhandledRejection", (reason: any) => {
    console.log("unhandledRejection", reason);
  })
  .on("uncaughtException", (reason: any) => {
    console.log("uncaughtException", reason);
  });
