function validatePhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    throw new Error("Phone number is required");
  }

  const phoneRegex = /^62\d{9,15}$/;
  if (!phoneRegex.test(phoneNumber)) {
    throw new Error(
      "Invalid phone number format. It should start with 62 and followed by 9 to 15 digits."
    );
  }
}

export async function sendSTP(phoneNumber, captchaToken) {
  validatePhoneNumber(phoneNumber);

  const response = await fetch(
    "https://asia-southeast2-awangga.cloudfunctions.net/domyid/auth/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phonenumber: phoneNumber, captcha: captchaToken }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to send STP");
  }

  const result = await response.json();
  return result;
}

export async function verifySTP(phoneNumber, password) {
  validatePhoneNumber(phoneNumber);

  const response = await fetch(
    "https://asia-southeast2-awangga.cloudfunctions.net/domyid/auth/verify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phonenumber: phoneNumber, password }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to verify STP");
  }

  const result = await response.json();
  return result;
}

export async function resendSTP(phoneNumber) {
  validatePhoneNumber(phoneNumber);

  const response = await fetch(
    "https://asia-southeast2-awangga.cloudfunctions.net/domyid/auth/resend",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phonenumber: phoneNumber }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to resend STP");
  }

  const result = await response.json();
  return result;
}
