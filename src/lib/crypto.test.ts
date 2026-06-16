import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt, isEncryptionEnabled } from "./crypto";

const TEST_KEY = "a".repeat(64);

describe("crypto", () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  describe("with valid key", () => {
    beforeEach(() => {
      process.env.ENCRYPTION_KEY = TEST_KEY;
    });

    it("encrypts and decrypts a string", () => {
      const plaintext = "my-secret-password";
      const encrypted = encrypt(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.startsWith("enc:")).toBe(true);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it("produces different ciphertexts for the same input", () => {
      const plaintext = "same-input";
      expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
    });

    it("handles empty strings", () => {
      const encrypted = encrypt("");
      expect(decrypt(encrypted)).toBe("");
    });

    it("handles unicode", () => {
      const plaintext = "Mot de passe spécial: àéîöü 🔑";
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });

    it("returns plaintext for non-encrypted values (backward compat)", () => {
      expect(decrypt("plain-value")).toBe("plain-value");
    });

    it("reports encryption as enabled", () => {
      expect(isEncryptionEnabled()).toBe(true);
    });
  });

  describe("without key", () => {
    beforeEach(() => {
      delete process.env.ENCRYPTION_KEY;
    });

    it("returns plaintext when encrypting", () => {
      expect(encrypt("hello")).toBe("hello");
    });

    it("returns value as-is when decrypting enc: prefixed value", () => {
      const val = "enc:somegarbage";
      expect(decrypt(val)).toBe(val);
    });

    it("reports encryption as disabled", () => {
      expect(isEncryptionEnabled()).toBe(false);
    });
  });

  describe("with invalid key", () => {
    beforeEach(() => {
      process.env.ENCRYPTION_KEY = "tooshort";
    });

    it("falls back to plaintext", () => {
      expect(encrypt("test")).toBe("test");
      expect(isEncryptionEnabled()).toBe(false);
    });
  });
});
