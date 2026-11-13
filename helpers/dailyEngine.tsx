/*
 * Daily's call engine, served from our own origin.
 *
 * In call object mode daily-js downloads its call engine (call-machine-object-bundle.js) from
 * c.daily.co when a call starts. Some networks, DNS filters and browser secure-DNS settings cannot
 * reach c.daily.co, and then no call can start. daily-js lets us point it at another folder
 * (dailyConfig.bundlePathOverride), so the engine is served by endpoints/daily-engine_GET.ts on
 * the app's own domain: anyone who can open Testkart can load it.
 *
 * The endpoint only serves these files, for this exact version, and only when the bytes match
 * the checksums below. useDailyCall uses the override only when the installed daily-js is this
 * version, so upgrading the package falls back to c.daily.co instead of breaking calls.
 *
 * When upgrading @daily-co/daily-js: set DAILY_ENGINE_VERSION to the new version and replace both
 * checksums with the SHA-256 of
 *   https://c.daily.co/call-machine/versioned/<version>/static/<file>
 */
export const DAILY_ENGINE_VERSION = "0.95.0";

export const DAILY_ENGINE_FILES: Record<string, string> = {
  // The call engine itself, needed for every call.
  "call-machine-object-bundle.js": "0b313c3f8ea882e7df07daf2ba9d188c2adc201f9befb45e0c3e96a2b1db8b98",
  // Krisp noise cancellation, loaded by the engine only if that feature is turned on.
  "audio-processor-bundle.js": "a0b6d2ad8b73b2daf6530e4e1ca8e82f720fa5c2f2c13a7b5209010575e45a21",
};

/*
 * daily-js appends "/<file>.js" to the path, so ending it with "f=" turns every file into
 * /_api/daily-engine?v=<version>&f=/<file>.js, which one endpoint can answer.
 */
export const dailyEngineBundlePath = (origin: string) => `${origin}/_api/daily-engine?v=${DAILY_ENGINE_VERSION}&f=`;