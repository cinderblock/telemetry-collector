/**
 * Fail the build when the running Bun is not the one this repo declares.
 *
 * `packageManager` in package.json is the single source of truth for the Bun version.
 * GitHub CI reads it automatically (setup-bun checks that field first). Cloudflare
 * Workers Builds does not — it only honours a `BUN_VERSION` build variable, set in the
 * dashboard, and otherwise uses its own default. That is a second copy of the version
 * living outside the repo, and the two will eventually disagree.
 *
 * When they disagree in the obvious direction — the build image's Bun is too old to read
 * the lockfile — the install step already fails loudly. The dangerous direction is the
 * quiet one: a Bun different enough to resolve or build differently but not so different
 * that anything errors. This check makes every mismatch loud, and says exactly which
 * setting to change.
 *
 * In CI (GitHub Actions and Workers Builds both set `CI`) a mismatch fails the build.
 * On a workstation it only warns, so upgrading Bun locally does not stop you working.
 */

const pkg = (await Bun.file(new URL('../package.json', import.meta.url)).json()) as { packageManager?: string };

const declared = /^bun@(\d+\.\d+\.\d+)$/.exec(pkg.packageManager ?? '')?.[1];
if (!declared) {
  console.error(
    `error: package.json "packageManager" must be "bun@<x.y.z>", got ${JSON.stringify(pkg.packageManager)}`,
  );
  process.exit(1);
}

const running = Bun.version;
if (running === declared) process.exit(0);

const where = process.env.WORKERS_CI
  ? `Set the BUN_VERSION build variable to ${declared} (Workers & Pages → telemetry-collector → Settings → Builds → Variables and secrets).`
  : process.env.CI
    ? 'setup-bun should have read the version from package.json; check the workflow does not override it.'
    : `Install it with: bun upgrade --version ${declared}`;

const message = `Bun ${running} is running, but package.json declares bun@${declared}. ${where}`;

if (process.env.CI) {
  console.error(`error: ${message}`);
  process.exit(1);
}
console.warn(`warning: ${message}`);
