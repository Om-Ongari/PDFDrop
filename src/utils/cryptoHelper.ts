// Native Browser Web Crypto AES-GCM encryption/decryption utilities
// This allows true, zero-server secure password protection of documents

// Magic header bytes to identify PDFDrop secure files
const MAGIC_HEADER = "PDFDROP_SECURE::";

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 50000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPDFBytes(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    bytes
  );
  const encryptedBytes = new Uint8Array(encrypted);
  
  // Format: [Magic string as bytes] [16 bytes salt] [12 bytes iv] [encrypted bytes]
  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(MAGIC_HEADER);
  
  const packed = new Uint8Array(headerBytes.length + salt.length + iv.length + encryptedBytes.length);
  packed.set(headerBytes, 0);
  packed.set(salt, headerBytes.length);
  packed.set(iv, headerBytes.length + salt.length);
  packed.set(encryptedBytes, headerBytes.length + salt.length + iv.length);
  return packed;
}

export function isPDFDropSecureFile(bytes: Uint8Array): boolean {
  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(MAGIC_HEADER);
  if (bytes.length < headerBytes.length) return false;
  
  for (let i = 0; i < headerBytes.length; i++) {
    if (bytes[i] !== headerBytes[i]) return false;
  }
  return true;
}

export async function decryptPDFBytes(packed: Uint8Array, password: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(MAGIC_HEADER);
  
  const saltOffset = headerBytes.length;
  const ivOffset = saltOffset + 16;
  const dataOffset = ivOffset + 12;
  
  const salt = packed.slice(saltOffset, ivOffset);
  const iv = packed.slice(ivOffset, dataOffset);
  const encryptedBytes = packed.slice(dataOffset);
  
  const key = await deriveKey(password, salt);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedBytes
  );
  return new Uint8Array(decrypted);
}
