import { buildPayuRedirectHtml, isPayuPaymentUrl } from "./payuRedirectForm";

const hostile = '"><script>window.__pwned=1</script>&amp;<img src=x onerror=alert(1)>';

const fields = {
  key: "probe",
  txnid: "testkart-probe_1",
  amount: "1.00",
  productinfo: hostile,
  firstname: "Probe",
  email: "probe@example.com",
  phone: "9999999999",
  surl: "https://testkart.in/_api/payment/payu/callback",
  furl: "https://testkart.in/_api/payment/payu/callback",
  hash: "0000",
  udf1: undefined,
};

const render = (payuUrl: string) =>
  new DOMParser().parseFromString(buildPayuRedirectHtml(payuUrl, fields), "text/html");

describe("isPayuPaymentUrl", () => {
  it("accepts only the two PayU payment URLs", () => {
    expect(isPayuPaymentUrl("https://test.payu.in/_payment")).toBe(true);
    expect(isPayuPaymentUrl("https://secure.payu.in/_payment")).toBe(true);
    for (const url of [
      "https://evil.example/_payment",
      'https://secure.payu.in/_payment"><script>alert(1)</script>',
      "https://secure.payu.in.evil.example/_payment",
      "http://secure.payu.in/_payment",
      "javascript:alert(1)",
    ]) {
      expect(isPayuPaymentUrl(url)).toBe(false);
    }
  });
});

describe("buildPayuRedirectHtml", () => {
  it("posts to the PayU URL with only the submit script on the page", () => {
    const doc = render("https://secure.payu.in/_payment");
    expect(doc.querySelector("form")?.getAttribute("action")).toBe("https://secure.payu.in/_payment");
    expect(doc.querySelectorAll("script").length).toBe(1);
    expect(doc.querySelectorAll("img").length).toBe(0);
  });

  it("keeps every field value byte-for-byte after HTML decoding", () => {
    const doc = render("https://test.payu.in/_payment");
    for (const [name, value] of Object.entries(fields)) {
      const input = doc.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
      if (value === undefined) {
        expect(input).toBeNull();
      } else {
        expect(input?.value).toBe(value);
      }
    }
  });

  it("control: the previous raw form action let a crafted URL inject a script", () => {
    const crafted = 'https://evil.example/"><script>window.__pwned=1</script>';
    const legacy = `<form action="${crafted}" method="POST"></form>`;
    const doc = new DOMParser().parseFromString(legacy, "text/html");
    expect(doc.querySelectorAll("script").length).toBe(1);
  });

  it("control: the previous quote-only value escaping corrupted entity-like text", () => {
    const legacy = `<form><input type="hidden" name="productinfo" value="${hostile.replace(/"/g, "&quot;")}" /></form>`;
    const doc = new DOMParser().parseFromString(legacy, "text/html");
    expect((doc.querySelector("input") as HTMLInputElement).value).not.toBe(hostile);
  });
});
