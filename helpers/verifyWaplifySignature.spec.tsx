import { verifyWaplifySignature } from "./verifyWaplifySignature";

// Computed with node: HMAC-SHA256("test-secret", BODY), hex.
const BODY = '{"event": "webhook.test", "message": "Test webhook message"}';
const SIGNATURE = "sha256=9c500c1e08f91979a4da631f7b533e505d725c74c568f7bbced131602e42692c";

describe("verifyWaplifySignature", () => {
  it("accepts the right signature", () => {
    expect(verifyWaplifySignature("test-secret", BODY, SIGNATURE)).toBeTrue();
  });

  it("accepts the digest without the sha256= prefix and in upper case", () => {
    expect(verifyWaplifySignature("test-secret", BODY, SIGNATURE.slice(7).toUpperCase())).toBeTrue();
  });

  it("refuses a changed body, a wrong secret and a missing header", () => {
    expect(verifyWaplifySignature("test-secret", BODY.replace("test", "live"), SIGNATURE)).toBeFalse();
    expect(verifyWaplifySignature("other-secret", BODY, SIGNATURE)).toBeFalse();
    expect(verifyWaplifySignature("test-secret", BODY, null)).toBeFalse();
    expect(verifyWaplifySignature("", BODY, SIGNATURE)).toBeFalse();
  });
});