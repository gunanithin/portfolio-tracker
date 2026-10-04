import CryptoJS from 'crypto-js';

/**
 * Encrypts a Javascript object into a secure AES string using the user's Vault PIN.
 * @param {Object} data - The data object to encrypt (e.g., portfolio details).
 * @param {string} vaultPin - The secret key that only the user knows.
 * @returns {string} - The encrypted ciphertext.
 */
export const encryptData = (data, vaultPin) => {
  if (!vaultPin) throw new Error("Vault PIN is required for encryption.");
  try {
    const jsonString = JSON.stringify(data);
    const ciphertext = CryptoJS.AES.encrypt(jsonString, vaultPin).toString();
    return ciphertext;
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Failed to encrypt data.");
  }
};

/**
 * Decrypts a secure AES string back into a Javascript object using the user's Vault PIN.
 * @param {string} ciphertext - The encrypted string from Firestore.
 * @param {string} vaultPin - The secret key that only the user knows.
 * @returns {Object} - The decrypted data object.
 */
export const decryptData = (ciphertext, vaultPin) => {
  if (!vaultPin) throw new Error("Vault PIN is required for decryption.");
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, vaultPin);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedString) {
      throw new Error("Invalid Vault PIN or corrupted data.");
    }
    
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt data. Invalid PIN.");
  }
};
