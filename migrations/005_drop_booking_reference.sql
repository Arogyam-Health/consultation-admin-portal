-- Drop booking_reference column from consultant_bookings
-- The booking reference (TOK-XXXXXXXX) is no longer used in the UI or API responses.

ALTER TABLE consultant_bookings DROP COLUMN IF EXISTS booking_reference;
