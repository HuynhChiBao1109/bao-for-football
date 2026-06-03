import * as bcrypt from "bcrypt";

const DEFAULT_SALT_ROUNDS = 10;

async function generateSalt(
  rounds: number = DEFAULT_SALT_ROUNDS,
): Promise<string> {
  return bcrypt.genSalt(rounds);
}

async function generateHash(value: string, salt: string): Promise<string> {
  return bcrypt.hash(value, salt);
}

async function compareHashWithSalt({ value, hashedValue, salt }: { value: string; hashedValue: string; salt: string }): Promise<boolean> {
  const hash = await generateHash(value, salt);

  return hash === hashedValue;
}

export const CryptoUtil = {
  generateSalt,
  generateHash,
  compareHashWithSalt,
};
