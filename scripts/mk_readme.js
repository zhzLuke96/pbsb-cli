const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { exec } = require("child_process");
const execP = promisify(exec);

const tpl_text = fs
  .readFileSync(path.join(__dirname, "readme.tpl.md"))
  .toString();

const tokens = [];
const reg = /{{(.+?)}}/g;
let match;
let index = 0;
do {
  match = reg.exec(tpl_text);
  if (match) {
    tokens.push({
      type: "text",
      text: tpl_text.slice(index, match.index),
    });
    tokens.push({
      type: "shell",
      text: tpl_text.slice(match.index, match.index + match[0].length),
    });
    index = match.index + match[0].length;
  }
} while (match);
tokens.push({
  type: "text",
  text: tpl_text.slice(index),
});

Promise.all(
  tokens.map(async (token) => {
    switch (token.type) {
      case "text": {
        break;
      }
      case "shell": {
        const shell = token.text.slice(2, -2).trim();
        console.log(`[exec]`, shell);
        const { stdout } = await execP(shell);
        token.stdout = stdout.trim().split("\n").slice(2, -1).join("\n").trim();
        break;
      }
    }
  })
).then(() => {
  let content = "";
  for (const token of tokens) {
    content += token.stdout || token.text || "";
  }
  //   console.log(content);
  fs.writeFileSync(path.join(__dirname, "..", "README.md"), content);
});
