import { describe, it, expect } from "vitest";
import { validatePassword, passwordErrorMessage } from "./password";

describe("validatePassword", () => {
  it("accepts a strong password", () => {
    const result = validatePassword("MyP@ss1ng");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects short passwords", () => {
    const result = validatePassword("Aa1!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Au moins 8 caractères");
  });

  it("requires uppercase", () => {
    const result = validatePassword("myp@ss1ng");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Au moins une majuscule");
  });

  it("requires lowercase", () => {
    const result = validatePassword("MYP@SS1NG");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Au moins une minuscule");
  });

  it("requires a digit", () => {
    const result = validatePassword("MyP@ssing");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Au moins un chiffre");
  });

  it("requires a special character", () => {
    const result = validatePassword("MyPass1ng");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Au moins un caractère spécial (!@#$%...)");
  });

  it("reports multiple errors at once", () => {
    const result = validatePassword("abc");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe("passwordErrorMessage", () => {
  it("formats errors into a single string", () => {
    const msg = passwordErrorMessage({
      valid: false,
      errors: ["Au moins 8 caractères", "Au moins une majuscule"],
    });
    expect(msg).toBe("Mot de passe invalide : Au moins 8 caractères, Au moins une majuscule");
  });
});
