// Mocks must be applied before importing the module under test to avoid pulling ESM dependencies
jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn((opts) => opts),
}));
jest.mock('next-auth/providers/google', () => jest.fn((opts) => ({ ...opts, name: 'Google' })));
jest.mock('next-auth/providers/github', () => jest.fn((opts) => ({ ...opts, name: 'GitHub' })));
jest.mock('next-auth/providers/credentials', () => jest.fn((opts) => ({ ...opts, name: 'Credentials', ...opts })));

jest.mock('../mongodb', () => jest.fn(async () => Promise.resolve()));

const mockFindOne = jest.fn();
const mockCreate = jest.fn();

jest.mock('../../models/User', () => ({
  findOne: (...args: any[]) => mockFindOne(...args),
  create: (...args: any[]) => mockCreate(...args),
}));

jest.mock('../auth-utils', () => ({
  verifyPassword: jest.fn(async (p: string, h: string) => p === 'valid'),
  isValidEmailDomain: jest.fn((email: string) => email.endsWith('@example.com')),
}));

jest.mock('../env', () => ({
  env: {
    google: { clientId: 'x', clientSecret: 'y' },
    github: { clientId: 'x', clientSecret: 'y' },
    nextAuth: { secret: 's' },
    nodeEnv: 'test',
  }
}));

import { authOptions } from '../auth';

describe('Credentials authorize', () => {
  const findCredentialsAuthorize = () => {
    const providers: any[] = (authOptions as any).providers || [];
    for (const p of providers) {
      if (typeof p === 'object' && p.name === 'Credentials' && typeof p.authorize === 'function') return p.authorize;
      // Some provider factories wrap options
      if (p?.options?.authorize) return p.options.authorize;
      if (p?.authorize) return p.authorize;
    }
    throw new Error('Credentials authorize not found');
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns null when missing credentials', async () => {
    const authorize = findCredentialsAuthorize();
    // @ts-ignore
    const res = await authorize(undefined);
    expect(res).toBeNull();
  });

  test('throws on invalid email domain', async () => {
    const authorize = findCredentialsAuthorize();
    await expect(authorize({ email: 'user@bad.com', password: 'x' })).rejects.toThrow(/valid email/);
  });

  test('returns null when user not found', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    const authorize = findCredentialsAuthorize();
    const res = await authorize({ email: 'user@example.com', password: 'x' });
    expect(res).toBeNull();
    expect(mockFindOne).toHaveBeenCalledWith({ email: 'user@example.com' });
  });

  test('returns null when password invalid', async () => {
    mockFindOne.mockResolvedValueOnce({ _id: '1', password: 'hash' });
    const authorize = findCredentialsAuthorize();
    const res = await authorize({ email: 'user@example.com', password: 'wrong' });
    expect(res).toBeNull();
  });

  test('throws when email not verified', async () => {
    mockFindOne.mockResolvedValueOnce({ _id: '1', password: 'hash', emailVerificationToken: 't' });
    const authorize = findCredentialsAuthorize();
    await expect(authorize({ email: 'user@example.com', password: 'valid' })).rejects.toThrow(/verify your email/);
  });

  test('returns user payload when valid', async () => {
    mockFindOne.mockResolvedValueOnce({ _id: { toString: () => '42' }, password: 'hash', name: 'Joe', email: 'user@example.com', image: 'i' });
    const authorize = findCredentialsAuthorize();
    const res = await authorize({ email: 'user@example.com', password: 'valid' });
    expect(res).toEqual({ id: '42', name: 'Joe', email: 'user@example.com', image: 'i' });
  });
});
