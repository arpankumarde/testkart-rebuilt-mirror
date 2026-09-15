import { isAppDeepLink } from "./isAppDeepLink";

describe("isAppDeepLink", () => {
  it("accepts the installed app scheme", () => {
    expect(isAppDeepLink("testkart://callback")).toBe(true);
  });

  it("accepts Expo Go links to a dev server on localhost or a private network", () => {
    expect(isAppDeepLink("exp://192.168.1.5:8081/--/callback")).toBe(true);
    expect(isAppDeepLink("exp://10.0.2.2:8081/--/callback")).toBe(true);
    expect(isAppDeepLink("exp://172.20.0.4:8081/--/callback")).toBe(true);
    expect(isAppDeepLink("exp://127.0.0.1:8081/--/callback")).toBe(true);
    expect(isAppDeepLink("exp://localhost:8081/--/callback")).toBe(true);
  });

  it("rejects Expo Go links to a public host", () => {
    expect(isAppDeepLink("exp://evil.example:8081/--/callback")).toBe(false);
    expect(isAppDeepLink("exp://8.8.8.8:8081/--/callback")).toBe(false);
    expect(isAppDeepLink("exp://172.32.0.1:8081/--/callback")).toBe(false);
    expect(isAppDeepLink("exp://192.168.1.5.evil.example/--/callback")).toBe(false);
  });

  it("rejects web URLs in any letter case and paths", () => {
    expect(isAppDeepLink("HTTPS://evil.example")).toBe(false);
    expect(isAppDeepLink("https://testkart.in/dashboard")).toBe(false);
    expect(isAppDeepLink("/dashboard")).toBe(false);
    expect(isAppDeepLink("javascript://%0Aalert(1)")).toBe(false);
  });
});
