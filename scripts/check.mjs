import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
for (const file of [
  "server.mjs",
  ...["lib", "public", "scripts", "tests"].flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => /\.(mjs|js)$/.test(f))
      .map((f) => dir + "/" + f),
  ),
]) {
  const r = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (r.status) process.exit(r.status);
}
console.log("All JavaScript syntax checks passed");
