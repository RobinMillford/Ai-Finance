import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

// Function to validate email domains
export function isValidEmailDomain(email: string): boolean {
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return false;
  }

  // Check for valid domains (common email providers)
  const validDomains = [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 
    'icloud.com', 'aol.com', 'protonmail.com', 'mail.com',
    'zoho.com', 'yandex.com', 'qq.com', '163.com', '126.com',
    'gmx.com', 'live.com', 'msn.com', 'ymail.com'
  ];
  
  const domain = email.split('@')[1].toLowerCase();
  return validDomains.includes(domain);
}