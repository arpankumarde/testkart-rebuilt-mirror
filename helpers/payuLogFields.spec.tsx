import { payuLogFields } from "./payuLogFields";

const txnid = "testkart-AbC_12-xYz9";

// A Verify Payment API transaction_details entry with made-up customer values.
const verifyDetails = {
  mihpayid: "403993715531234567",
  bank_ref_num: "BRN20260911XY",
  amt: "109.00",
  txnid,
  productinfo: "Study notes",
  firstname: "Asha",
  lastname: "Verma",
  email: "asha.verma@example.com",
  phone: "9876543210",
  address1: "12 MG Road",
  address2: "Flat 4B",
  city: "Pune",
  state: "Maharashtra",
  zipcode: "411001",
  status: "failure",
  unmappedstatus: "userCancelled",
  error_code: "E1605",
  error_Message: "Transaction cancelled",
  name_on_card: "ASHA VERMA",
  cardnum: "512345XXXXXX2346",
  card_no: "512345XXXXXX2346",
  cardhash: "9f86d081884c7d659a2feaa0c55ad015",
  udf1: "testkart://payment/callback",
  field9: "Cancelled by user",
};

const personalKeys = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "address1",
  "address2",
  "city",
  "state",
  "zipcode",
  "name_on_card",
  "cardnum",
  "card_no",
  "cardhash",
  "bank_ref_num",
] as const;

describe("payuLogFields", () => {
  it("keeps only txnid, status, unmappedstatus, error_code and mihpayid from a verify response", () => {
    expect(payuLogFields(verifyDetails)).toEqual({
      txnid,
      status: "failure",
      unmappedstatus: "userCancelled",
      error_code: "E1605",
      mihpayid: "403993715531234567",
    });
  });

  it("lets no personal value into the logged JSON", () => {
    const logged = JSON.stringify(payuLogFields(verifyDetails));
    for (const key of personalKeys) {
      expect(logged).not.toContain(verifyDetails[key]);
    }
  });

  it("control: the full response dump it replaces contains every personal value", () => {
    const logged = JSON.stringify(verifyDetails, null, 2);
    for (const key of personalKeys) {
      expect(logged).toContain(verifyDetails[key]);
    }
  });

  it("reads the callback's error field and drops the hash and customer fields", () => {
    const callback = {
      txnid,
      status: "failure",
      error: "E308",
      error_Message: "Bank declined",
      mihpayid: "403993715531234568",
      hash: "b94d27b9934d3e08a52e52d7da7dabfa",
      firstname: "Asha",
      email: "asha.verma@example.com",
      phone: "9876543210",
      mode: "CC",
    };
    expect(payuLogFields(callback)).toEqual({
      txnid,
      status: "failure",
      error: "E308",
      mihpayid: "403993715531234568",
    });
  });

  it("returns an empty object when PayU sent no entry, and skips non-text values", () => {
    expect(payuLogFields(undefined)).toEqual({});
    expect(payuLogFields(null)).toEqual({});
    expect(payuLogFields({ txnid: { name: "upload.txt" }, status: "success" })).toEqual({ status: "success" });
  });
});