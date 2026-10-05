// Prints a bcrypt hash for ADMIN_PASSWORD_HASH.
//   npm run hash-password            asks for the password at a hidden prompt (recommended)
//   npm run hash-password -- 'pw'    takes it as an argument
// Prefer the prompt on Windows: npm passes arguments through cmd.exe, which mangles " & % ^ !
// so the hash would be of a different password than the one you type at login.
import bcrypt from "bcryptjs";

// Input that arrived after the previous answer's line break (both lines pasted or piped at once).
let leftover = "";
let afterCR = false;

function ask(prompt: string): Promise<string> {
  const stdin = process.stdin;
  process.stdout.write(prompt);
  return new Promise((resolve) => {
    let s = "";
    // Adds characters to the answer; true once a line break ends it.
    const feed = (chunk: string): boolean => {
      for (let i = 0; i < chunk.length; i++) {
        const c = chunk[i];
        if (c === "\n" && afterCR) { afterCR = false; continue; }
        afterCR = c === "\r";
        if (c === "\r" || c === "\n") { leftover = chunk.slice(i + 1); return true; }
        if (c === "\u0003") process.exit(130); // Ctrl+C
        if (c === "\u007f" || c === "\b") s = s.slice(0, -1);
        else s += c;
      }
      return false;
    };
    const done = () => {
      stdin.off("data", onData);
      stdin.off("end", done);
      if (stdin.isTTY) stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
      resolve(s);
    };
    const onData = (chunk: string) => { if (feed(chunk)) done(); };
    const rest = leftover;
    leftover = "";
    if (feed(rest)) { process.stdout.write("\n"); return resolve(s); }
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
    stdin.once("end", done);
    stdin.resume();
  });
}

async function main() {
  let pw = process.argv[2];
  if (pw === undefined) {
    pw = await ask("Password (hidden): ");
    if ((await ask("Same password again: ")) !== pw) {
      console.error("The two passwords differ. Nothing printed.");
      process.exit(1);
    }
  }
  if (pw.length < 10) {
    console.error("Use a password of at least 10 characters.");
    process.exit(1);
  }
  const hash = bcrypt.hashSync(pw, 12);
  if (!bcrypt.compareSync(pw, hash)) throw new Error("Hash check failed");
  console.log("Paste this line, exactly, as the value of ADMIN_PASSWORD_HASH (no quotes, no spaces):");
  console.log(hash);
}
main();
