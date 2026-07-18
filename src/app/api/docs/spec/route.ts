import { NextRequest, NextResponse } from 'next/server';

/**
 * Swagger/OpenAPI JSON spec served at /api/docs/spec
 */
export async function GET(_req: NextRequest) {
  const spec = {
    openapi: '3.0.0',
    info: {
      title: 'The Obesity Killer — Consultation API',
      version: '1.0.0',
      description: 'Backend API for the Shopify-integrated weight-loss consultative booking platform.',
      contact: { name: 'The Obesity Killer', url: 'https://theobesitykiller.com' },
    },
    servers: [
      { url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', description: 'Local' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            error: { type: 'string' },
          },
        },
      },
    },
    tags: [
      { name: 'OTP', description: 'Phone number verification via OTP' },
      { name: 'Public Slots', description: 'Slot availability for users' },
      { name: 'Public Bookings', description: 'Booking creation by users' },
      { name: 'Admin Auth', description: 'Admin authentication' },
      { name: 'Consultants', description: 'Consultant CRUD (admin)' },
      { name: 'Working Hours', description: 'Weekly schedule (admin)' },
      { name: 'Slot Overrides', description: 'Date-specific overrides (admin)' },
      { name: 'Leaves', description: 'Consultant leave management (admin)' },
      { name: 'Slots', description: 'Slot generation and management (admin)' },
      { name: 'Bookings', description: 'Booking management (admin)' },
      { name: 'WebSocket', description: 'Real-time slot updates via WebSocket' },
    ],
    paths: {
      '/api/otp/send': {
        post: {
          tags: ['OTP'],
          summary: 'Send OTP to phone number',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone'],
                  properties: { phone: { type: 'string', example: '+919876543210' } },
                },
              },
            },
          },
          responses: {
            200: { description: 'OTP sent. Returns session_id and (in mock mode) debug_otp.' },
            400: { description: 'Validation error or rate limit exceeded' },
          },
        },
      },
      '/api/otp/verify': {
        post: {
          tags: ['OTP'],
          summary: 'Verify OTP',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['session_id', 'otp', 'phone'],
                  properties: {
                    session_id: { type: 'string', format: 'uuid' },
                    otp: { type: 'string', example: '123456' },
                    phone: { type: 'string', example: '+919876543210' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Verification result' },
            400: { description: 'Invalid or expired OTP' },
          },
        },
      },
      '/api/slots': {
        get: {
          tags: ['Public Slots'],
          summary: 'Get slots for a date range',
          parameters: [
            { in: 'query', name: 'from', required: true, schema: { type: 'string', format: 'date' }, example: '2026-07-15' },
            { in: 'query', name: 'to', required: true, schema: { type: 'string', format: 'date' }, example: '2026-07-21' },
            { in: 'query', name: 'consultant_id', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { 200: { description: 'List of slots with status' } },
        },
      },
      '/api/bookings': {
        post: {
          tags: ['Public Bookings'],
          summary: 'Book a consultation slot',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['slot_id', 'phone', 'full_name', 'otp_session_id'],
                  properties: {
                    slot_id: { type: 'string', format: 'uuid' },
                    phone: { type: 'string', example: '+919876543210' },
                    full_name: { type: 'string', example: 'Rahul Sharma' },
                    email: { type: 'string', format: 'email' },
                    otp_session_id: { type: 'string', format: 'uuid' },
                    session_id: { type: 'string', format: 'uuid', description: 'Assessment session ID' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Booking confirmed' },
            400: { description: 'OTP not verified' },
            409: { description: 'Slot already taken' },
          },
        },
        get: {
          tags: ['Public Bookings'],
          summary: 'Look up booking by phone',
          parameters: [
            { in: 'query', name: 'phone', required: true, schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Booking details' } },
        },
      },
      '/api/admin/auth/login': {
        post: {
          tags: ['Admin Auth'],
          summary: 'Admin login',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', example: 'admin@theobesitykiller.com' },
                    password: { type: 'string', example: 'Admin@123' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'JWT token + admin info' },
            401: { description: 'Invalid credentials' },
          },
        },
      },
      '/api/admin/consultants': {
        get: {
          tags: ['Consultants'],
          summary: 'List all consultants',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Consultant list' } },
        },
        post: {
          tags: ['Consultants'],
          summary: 'Create consultant',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['full_name', 'email'],
                  properties: {
                    full_name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' },
                    specialization: { type: 'string' },
                    timezone: { type: 'string', example: 'Asia/Kolkata' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Created consultant' } },
        },
      },
      '/api/admin/consultants/{id}': {
        get: { tags: ['Consultants'], summary: 'Get consultant', security: [{ BearerAuth: [] }] },
        patch: { tags: ['Consultants'], summary: 'Update consultant', security: [{ BearerAuth: [] }] },
        delete: { tags: ['Consultants'], summary: 'Deactivate consultant', security: [{ BearerAuth: [] }] },
      },
      '/api/admin/working-hours': {
        get: {
          tags: ['Working Hours'],
          summary: 'Get working hours',
          security: [{ BearerAuth: [] }],
          parameters: [{ in: 'query', name: 'consultant_id', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { 200: { description: 'Working hours per day' } },
        },
        post: {
          tags: ['Working Hours'],
          summary: 'Set working hours',
          security: [{ BearerAuth: [] }],
          responses: { 201: { description: 'Saved hours' } },
        },
      },
      '/api/admin/slot-overrides': {
        get: { tags: ['Slot Overrides'], summary: 'List overrides', security: [{ BearerAuth: [] }] },
        post: { tags: ['Slot Overrides'], summary: 'Create/update override', security: [{ BearerAuth: [] }] },
      },
      '/api/admin/leaves': {
        get: { tags: ['Leaves'], summary: 'List leaves', security: [{ BearerAuth: [] }] },
        post: { tags: ['Leaves'], summary: 'Create leave', security: [{ BearerAuth: [] }] },
        delete: { tags: ['Leaves'], summary: 'Delete leave (pass ?id=)', security: [{ BearerAuth: [] }] },
      },
      '/api/admin/slots': {
        get: {
          tags: ['Slots'],
          summary: 'List slots (admin, all statuses)',
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'consultant_id', schema: { type: 'string' } },
            { in: 'query', name: 'from', schema: { type: 'string', format: 'date' } },
            { in: 'query', name: 'to', schema: { type: 'string', format: 'date' } },
            { in: 'query', name: 'status', schema: { type: 'string', enum: ['available', 'booked', 'blocked', 'expired'] } },
          ],
          responses: { 200: { description: 'Slot list' } },
        },
        post: {
          tags: ['Slots'],
          summary: 'Generate slots for date range',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['consultant_id', 'from_date', 'to_date'],
                  properties: {
                    consultant_id: { type: 'string', format: 'uuid' },
                    from_date: { type: 'string', format: 'date' },
                    to_date: { type: 'string', format: 'date' },
                    duration_override: { type: 'integer', enum: [15, 20, 30, 45, 60] },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Generation result with created/skipped counts' } },
        },
      },
      '/api/admin/slots/{id}/block': {
        post: { tags: ['Slots'], summary: 'Block a slot', security: [{ BearerAuth: [] }] },
        delete: { tags: ['Slots'], summary: 'Unblock a slot', security: [{ BearerAuth: [] }] },
      },
      '/api/admin/bookings': {
        get: {
          tags: ['Bookings'],
          summary: 'List bookings',
          security: [{ BearerAuth: [] }],
          parameters: [
            { in: 'query', name: 'status', schema: { type: 'string' } },
            { in: 'query', name: 'consultant_id', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Booking list' } },
        },
      },
      '/api/admin/bookings/{id}': {
        get: { tags: ['Bookings'], summary: 'Get booking detail', security: [{ BearerAuth: [] }] },
        patch: {
          tags: ['Bookings'],
          summary: 'Update booking status',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: {
                    status: { type: 'string', enum: ['confirmed', 'cancelled', 'completed', 'no_show'] },
                    cancelled_reason: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Updated booking' } },
        },
      },
      '/api/ws-info': {
        get: {
          tags: ['WebSocket'],
          summary: 'WebSocket connection information',
          responses: { 200: { description: 'WS URL and usage guide' } },
        },
      },
    },
  };

  return NextResponse.json(spec);
}
