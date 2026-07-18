/**
 * Unit Tests: Slot Generator (with Supabase mocked)
 */

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

import { supabaseAdmin } from '@/lib/supabase';
import { generateSlots } from '@/lib/slots/generator';

const mockFrom = supabaseAdmin.from as jest.Mock;

function makeResolved(val: unknown) {
  const then = (fn: (v: unknown) => unknown) => Promise.resolve(val).then(fn);
  return { then, data: val, error: null };
}

function makeChain() {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    data: [],
    error: null,
    count: 0,
  };
  // Make the chain thenable and also resolve to {data, error} on .then
  return Object.assign(chain, {
    then: (fn: (v: unknown) => unknown) => Promise.resolve(chain).then(fn),
  });
}

const makeChainWithData = (data: unknown, overrides?: Record<string, unknown>) => {
  const c = makeChain();
  c.data = data;
  if (overrides) Object.assign(c, overrides);
  c.then = (fn: (v: unknown) => unknown) => Promise.resolve(c).then(fn);
  return c;
};

const consultantData = { id: 'fixed-consultant-id', timezone: 'Asia/Kolkata', is_active: true };

describe('generateSlots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DEFAULT_CONSULTANT_ID = '';
  });

  it('should throw if no consultant and no env var', async () => {
    const chain = makeChainWithData(null, { error: { message: 'Not found' } });
    mockFrom.mockReturnValue(chain);

    await expect(generateSlots({
      fromDate: '2026-07-15',
      toDate: '2026-07-15',
      startTime: '10:00',
      endTime: '18:00',
      durationMinutes: 30,
    })).rejects.toThrow('No active consultant found');
  });

  it('should create slots for the given range and duration', async () => {
    process.env.DEFAULT_CONSULTANT_ID = 'fixed-id';
    const c = makeChain();
    c.data = [];
    c.count = 0;
    c.then = (fn: (v: unknown) => unknown) => Promise.resolve(c).then(fn);
    // insert needs to succeed
    (c.insert as jest.Mock).mockReturnValue(makeChainWithData({ error: null }));
    mockFrom.mockReturnValue(c);

    const result = await generateSlots({
      fromDate: '2026-08-01',
      toDate: '2026-08-01',
      startTime: '10:00',
      endTime: '12:00',
      durationMinutes: 60,
    });

    expect(result.created).toBe(2);
    expect(result.duplicates_skipped).toBe(0);
  });

  it('should skip frozen dates', async () => {
    process.env.DEFAULT_CONSULTANT_ID = 'fixed-id';
    const c = makeChain();
    c.data = [];
    c.count = 0;
    c.then = (fn: (v: unknown) => unknown) => Promise.resolve(c).then(fn);
    (c.insert as jest.Mock).mockReturnValue(makeChainWithData({ error: null }));
    mockFrom.mockReturnValue(c);

    // Override the frozen dates query to return a frozen date
    const origFrom = mockFrom;
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'consultant_frozen_dates') {
        return makeChainWithData([{ date: '2026-08-01' }]);
      }
      callCount++;
      return c;
    });

    const result = await generateSlots({
      fromDate: '2026-08-01',
      toDate: '2026-08-01',
      startTime: '10:00',
      endTime: '18:00',
      durationMinutes: 30,
    });

    expect(result.created).toBe(0);
    expect(result.frozen_skipped).toBe(1);
  });

  it('should skip slots in break period', async () => {
    process.env.DEFAULT_CONSULTANT_ID = 'fixed-id';
    const c = makeChain();
    c.data = [];
    c.count = 0;
    c.then = (fn: (v: unknown) => unknown) => Promise.resolve(c).then(fn);
    (c.insert as jest.Mock).mockReturnValue(makeChainWithData({ error: null }));
    mockFrom.mockReturnValue(c);

    const result = await generateSlots({
      fromDate: '2026-08-01',
      toDate: '2026-08-01',
      startTime: '10:00',
      endTime: '13:00',
      durationMinutes: 30,
      breakStart: '11:00',
      breakEnd: '12:00',
    });

    // 10:00-10:30, 10:30-11:00, 12:00-12:30, 12:30-13:00 = 4 slots
    expect(result.created).toBe(4);
  });
});
