import { verifySvixSignature } from "./verifySvixSignature";

// The worked example from the Svix webhook verification docs.
const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const ID = "msg_p5jXN8AQM9LWM0D4loKWxJek";
const TIMESTAMP = "1614265330";
const BODY = '{"test": 2432232314}';
const SIGNATURE = "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=";

const base = { secret: SECRET, id: ID, timestamp: TIMESTAMP, body: BODY, nowSeconds: 1614265330 };

describe("verifySvixSignature", () => {
  it("accepts the documented signature", () => {
    expect(verifySvixSignature({ ...base, signatureHeader: SIGNATURE })).toBeTrue();
  });

  it("accepts a matching entry among several", () => {
    expect(verifySvixSignature({ ...base, signatureHeader: `v1,AAAA ${SIGNATURE}` })).toBeTrue();
  });

  it("refuses a changed body", () => {
    expect(verifySvixSignature({ ...base, body: '{"test": 1}', signatureHeader: SIGNATURE })).toBeFalse();
  });

  it("refuses an old timestamp", () => {
    expect(verifySvixSignature({ ...base, nowSeconds: 1614265330 + 3600, signatureHeader: SIGNATURE })).toBeFalse();
  });

  it("refuses missing headers", () => {
    expect(verifySvixSignature({ ...base, signatureHeader: null })).toBeFalse();
    expect(verifySvixSignature({ ...base, id: null, signatureHeader: SIGNATURE })).toBeFalse();
  });
});