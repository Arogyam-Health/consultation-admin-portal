import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

export interface AdminJwtPayload {
  sub: string;      // admin_users.id
  email: string;
  role: string;
  iat: number;
  exp: number;
}

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

export function signAdminToken(payload: Omit<AdminJwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions);
}

export function verifyAdminToken(token: string): AdminJwtPayload {
  return jwt.verify(token, SECRET) as AdminJwtPayload;
}

/**
 * Extract and verify Bearer token from NextRequest.
 * Returns null if missing or invalid.
 */
export function extractAdminFromRequest(req: NextRequest): AdminJwtPayload | null {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    return verifyAdminToken(auth.slice(7));
  } catch {
    return null;
  }
}

/** Middleware helper — throws 401 response if not authenticated */
export function requireAdmin(req: NextRequest): AdminJwtPayload {
  const admin = extractAdminFromRequest(req);
  if (!admin) {
    throw new Error('UNAUTHORIZED');
  }
  return admin;
}
