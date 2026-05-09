import _sodium from 'libsodium-wrappers';

let sodium: any;

export const initSodium = async () => {
  await _sodium.ready;
  sodium = _sodium;
};

export const generateKeyPair = () => {
  if (!sodium) throw new Error("Sodium not initialized");
  const { publicKey, privateKey } = sodium.crypto_box_keypair();
  return {
    publicKey: sodium.to_hex(publicKey),
    privateKey: sodium.to_hex(privateKey),
  };
};

export const encryptMessage = (message: string, sharedSecret: string) => {
  if (!sodium) throw new Error("Sodium not initialized");
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const key = sodium.from_hex(sharedSecret);
  const encrypted = sodium.crypto_secretbox_easy(message, nonce, key);
  return sodium.to_hex(nonce) + sodium.to_hex(encrypted);
};

export const decryptMessage = (encryptedMessage: string, sharedSecret: string) => {
  if (!sodium) throw new Error("Sodium not initialized");
  try {
    const nonce = sodium.from_hex(encryptedMessage.slice(0, sodium.crypto_secretbox_NONCEBYTES * 2));
    const encrypted = sodium.from_hex(encryptedMessage.slice(sodium.crypto_secretbox_NONCEBYTES * 2));
    const key = sodium.from_hex(sharedSecret);
    const decrypted = sodium.crypto_secretbox_open_easy(encrypted, nonce, key);
    return sodium.to_string(decrypted);
  } catch (error) {
    return null;
  }
};

/**
 * Derives a shared secret using Diffie-Hellman (X25519).
 * This is deterministic: crypto_box_beforenm(theirPublic, myPrivate) 
 * will yield the same result for both parties.
 */
export const deriveSharedSecret = (myPublicKey: string, myPrivateKey: string, theirPublicKey: string) => {
  if (!sodium) throw new Error("Sodium not initialized");
  
  const myPriv = sodium.from_hex(myPrivateKey);
  const theirPub = sodium.from_hex(theirPublicKey);
  
  // crypto_box_beforenm computes the shared secret for X25519
  const secret = sodium.crypto_box_beforenm(theirPub, myPriv);
  return sodium.to_hex(secret);
};
