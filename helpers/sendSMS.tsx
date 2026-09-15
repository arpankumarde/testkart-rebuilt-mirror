const MSG91_API_URL = "https://control.msg91.com/api/v5/flow/";

export async function sendSMS(mobileNumber: string, otpCode: string): Promise<boolean> {
  const { MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_TEMPLATE_ID } = process.env;

  if (!MSG91_AUTH_KEY) {
    throw new Error("MSG91_AUTH_KEY environment variable is not set.");
  }
  if (!MSG91_SENDER_ID) {
    throw new Error("MSG91_SENDER_ID environment variable is not set.");
  }
  if (!MSG91_TEMPLATE_ID) {
    throw new Error("MSG91_TEMPLATE_ID environment variable is not set.");
  }

  const payload = {
    template_id: MSG91_TEMPLATE_ID,
    sender: MSG91_SENDER_ID,
    short_url: "0", // 0 for off, 1 for on
    mobiles: `91${mobileNumber}`, // MSG91 requires country code
    // Assuming the template has a variable named 'OTP'
    // e.g., "Your OTP for Testkart is ##OTP##."
    OTP: otpCode, 
  };

  try {
    const response = await fetch(MSG91_API_URL, {
      method: 'POST',
      headers: {
        'authkey': MSG91_AUTH_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`MSG91 API Error: Status ${response.status}`, errorBody);
      return false;
    }

    const result = await response.json();
    
    // MSG91 v5 API returns "success" for successful requests
    if (result.type === 'success') {
      console.log(`Successfully sent OTP to ${mobileNumber}`);
      return true;
    } else {
      console.error(`MSG91 API returned failure:`, result);
      return false;
    }
  } catch (error) {
    console.error("Failed to send SMS via MSG91:", error);
    return false;
  }
}