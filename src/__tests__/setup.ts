// ─── Test Environment Setup ───────────────────────────────────────────────────
// Set env vars before any module imports
// Note: NODE_ENV is read-only in TypeScript strict mode; Jest sets it automatically
process.env.OTP_PROVIDER = 'mock';
process.env.JWT_SECRET = 'test-secret-for-unit-tests-only';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
