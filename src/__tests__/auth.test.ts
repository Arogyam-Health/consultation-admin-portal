/**
 * Unit Tests: JWT Auth utilities
 */
import { signAdminToken, verifyAdminToken, extractAdminFromRequest } from '@/lib/auth/jwt';
import { NextRequest } from 'next/server';

describe('JWT Auth', () => {
  const payload = { sub: 'test-id-123', email: 'admin@test.com', role: 'admin' };

  it('should sign and verify a token', () => {
    const token = signAdminToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyAdminToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
  });

  it('should throw on tampered token', () => {
    const token = signAdminToken(payload);
    expect(() => verifyAdminToken(token + 'tampered')).toThrow();
  });

  it('should extract admin from request with Bearer token', () => {
    const token = signAdminToken(payload);
    const req = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const admin = extractAdminFromRequest(req);
    expect(admin).not.toBeNull();
    expect(admin?.sub).toBe(payload.sub);
  });

  it('should return null when no Authorization header', () => {
    const req = new NextRequest('http://localhost/api/test');
    expect(extractAdminFromRequest(req)).toBeNull();
  });

  it('should return null for invalid Bearer token', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    expect(extractAdminFromRequest(req)).toBeNull();
  });
});
