import fs from 'node:fs/promises';

export async function resolveCredential(credentialRef) {
  if (!credentialRef || typeof credentialRef !== 'string') {
    throw new Error('Invalid credential reference');
  }

  if (credentialRef.startsWith('env://')) {
    const key = credentialRef.slice('env://'.length);
    return process.env[key];
  }

  if (credentialRef.startsWith('file://')) {
    const filePath = credentialRef.slice('file://'.length);
    const content = await fs.readFile(filePath, 'utf8');
    return content.trim();
  }

  throw new Error(`Unsupported credential reference: ${credentialRef}`);
}

export default { resolveCredential };
