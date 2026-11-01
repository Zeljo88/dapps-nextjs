import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = new URL("./validate-build-env.mjs", import.meta.url);

function validate(apiUrl) {
  const env = { ...process.env };
  if (apiUrl === undefined) delete env.API_URL;
  else env.API_URL = apiUrl;
  return spawnSync(process.execPath, [fileURLToPath(script)], { env, encoding: "utf8" });
}

const missing = validate(undefined);
assert.notEqual(missing.status, 0);
assert.match(missing.stderr, /API_URL is required/);

const malformed = validate("not-a-url");
assert.notEqual(malformed.status, 0);
assert.match(malformed.stderr, /valid absolute URL/);

const insecureRemote = validate("http://api.example.com");
assert.notEqual(insecureRemote.status, 0);
assert.match(insecureRemote.stderr, /must use HTTPS/);

assert.equal(validate("http://127.0.0.1:8000").status, 0);
assert.equal(validate("https://api.example.com").status, 0);

console.log("API_URL configuration checks passed.");
