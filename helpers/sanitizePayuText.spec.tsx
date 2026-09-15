import { sanitizePayuText } from "./sanitizePayuText";

const hostileTitle = 'SSC "Mock" <img src=x onerror=alert(1)> | Paper 1';
const hostileName = 'Ravi"><script>window.__pwned=1</script>';

// The live test checkout form as shipped in testkart-app, which does not escape values.
const shippedAppForm = (productinfo: string, firstname: string) => `
<form method="POST" action="https://secure.payu.in/_payment">
  <input type="hidden" name="productinfo" value="${productinfo}" />
  <input type="hidden" name="firstname" value="${firstname}" />
</form>`;

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

const inputValue = (doc: Document, name: string) =>
  (doc.querySelector(`input[name="${name}"]`) as HTMLInputElement | null)?.value;

describe("sanitizePayuText", () => {
  it("leaves ordinary titles and names unchanged", () => {
    for (const value of ["SSC CGL Tier 1 & 2 - Rahul's Live Test", "Priya Sharma", "Student"]) {
      expect(sanitizePayuText(value)).toBe(value);
    }
  });

  it("replaces the PayU hash delimiter", () => {
    expect(sanitizePayuText("Paper 1 | Paper 2")).toBe("Paper 1   Paper 2");
  });

  it("keeps the shipped app form free of injected markup, with values read back as hashed", () => {
    const productinfo = sanitizePayuText(hostileTitle);
    const firstname = sanitizePayuText(hostileName);
    const doc = parse(shippedAppForm(productinfo, firstname));
    expect(doc.querySelectorAll("script, img").length).toBe(0);
    expect(doc.querySelectorAll("input").length).toBe(2);
    expect(inputValue(doc, "productinfo")).toBe(productinfo);
    expect(inputValue(doc, "firstname")).toBe(firstname);
  });

  it("control: unsanitized values break out of the shipped app form", () => {
    const doc = parse(shippedAppForm(hostileTitle, hostileName));
    expect(doc.querySelectorAll("script").length).toBe(1);
    expect(inputValue(doc, "productinfo")).not.toBe(hostileTitle);
  });
});