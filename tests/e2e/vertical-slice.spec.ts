import { expect, test } from "@playwright/test";
import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { TEST_CERTIFICATE } from "../fixtures/certificate";

test("registration, organisation, MFA, import, audit, REST, and passkey challenge", async ({
  page,
  context,
}) => {
  const email = `e2e-${Date.now()}@example.test`;
  const password = "Correct-Horse-Battery-Staple-2026";

  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("E2E Administrator");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByLabel("Organisation name").fill("E2E Certificate Operations");
  await page.getByRole("button", { name: "Create organisation" }).click();
  await expect(page).toHaveURL(/\/overview$/);

  await page.goto("/mfa");
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Set up TOTP" }).click();
  const uri = await page.locator(".mono").first().textContent();
  expect(uri).toContain("otpauth://totp/");
  const encoded = new URL(uri ?? "").searchParams.get("secret");
  const secret = new TextDecoder().decode(base32.decode(encoded ?? ""));
  const code = await createOTP(secret, { digits: 6, period: 30 }).totp();
  await page.getByLabel("Six-digit code").fill(code);
  await page.getByRole("button", { name: "Verify and finish" }).click();
  await expect(page).toHaveURL(/\/overview$/);

  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await page.goto("/mfa");
  await page.getByRole("button", { name: "Create passkey" }).click();
  await expect(page).toHaveURL(/\/overview$/);
  const passkeys = await context.request.get("/api/auth/passkey/list-user-passkeys");
  expect(passkeys.ok()).toBe(true);
  expect((await passkeys.json()).length).toBe(1);

  const passkeyOptions = await context.request.get(
    "/api/auth/passkey/generate-register-options?name=E2E%20passkey",
    { headers: { Origin: "http://localhost:3000" } },
  );
  expect(passkeyOptions.ok()).toBe(true);
  expect((await passkeyOptions.json()).challenge).toBeTruthy();

  await page.goto("/certificates/import");
  await page.getByLabel("PEM certificate or certificate chain").fill(TEST_CERTIFICATE);
  await page.getByLabel("Owner team").fill("Platform Security");
  await page.getByLabel("Business service").fill("Identity edge");
  await page.getByRole("button", { name: "Import and validate" }).click();
  await expect(page).toHaveURL(/\/certificates\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "api.example.test" })).toBeVisible();
  await expect(page.getByText("certificate.imported")).toBeVisible();
  await expect(page.getByText("Explainable risk")).toBeVisible();

  const certificateId = page.url().split("/").at(-1);
  const response = await context.request.get(`/api/v1/certificates/${certificateId}`);
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.data.commonName).toBe("api.example.test");
  expect(body.data.pem).toBeUndefined();
  expect(body.data.audit).toHaveLength(1);
});
