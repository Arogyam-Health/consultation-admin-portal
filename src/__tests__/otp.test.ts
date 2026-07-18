/**
 * Unit Tests: OTP Provider (Mock)
 * These tests do not require a real database or network connection.
 */
import { MockOtpProvider } from '@/lib/otp/mock.provider';
import { generateOtp, getOtpProvider } from '@/lib/otp';

describe('MockOtpProvider', () => {
  const provider = new MockOtpProvider();

  it('should return success with a message ID', async () => {
    const result = await provider.sendOtp('+919876543210', '123456');
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.messageId).toMatch(/^mock-\d+$/);
  });

  it('should log OTP to console', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await provider.sendOtp('+911234567890', '654321');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('generateOtp', () => {
  it('should return a 6-digit string', () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('should generate different OTPs on successive calls', () => {
    const otps = Array.from({ length: 10 }, generateOtp);
    const unique = new Set(otps);
    // Very low probability of collision
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe('getOtpProvider', () => {
  it('should return a provider named MockOtpProvider when OTP_PROVIDER=mock', () => {
    process.env.OTP_PROVIDER = 'mock';
    // After jest.resetModules(), the re-required class is a different reference
    // so we check constructor name instead of instanceof
    jest.resetModules();
    const { getOtpProvider: fresh } = require('@/lib/otp');
    const p = fresh();
    expect(p.constructor.name).toBe('MockOtpProvider');
  });
});
