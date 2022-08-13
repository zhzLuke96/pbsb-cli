import { Command } from 'commander';
import crypto from 'crypto';


const server_name = Buffer.from('cGJzYi5hcHA=', 'base64').toString();

// check https ssl
class ServerChecker {
    // TODO
}


class UpdateConsumer {
    // TODO
}


class TgHooker {
    // TODO
}


export const install_tg_hook_command = (program: Command) => {
    program.command('tg-hook')
        .description('call setWebhook to connect to the mq queue and execute the script to process all the updates in the queue')
        .argument('<filename>', 'bot script file')
        .option("-T, --token <string>", "bot token")
        .option("-x, --proxy [address]", "http proxy for request")
        .action(() => {
            const channel_name = crypto.randomUUID();
            // TODO
        })
}




