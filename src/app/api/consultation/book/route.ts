import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { ok, badRequest, conflict, serverError } from '@/lib/api/response';
import { broadcastSlotUpdate } from '@/lib/websocket/server';
import { sendBookingToWebhook } from '@/lib/integrations/webhook';
import { sendBookingConfirmation } from '@/lib/wati';

const BookSchema = z.object({
  sessionToken: z.string().uuid(),
  slotId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BookSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten());

    const { sessionToken, slotId } = parsed.data;

    console.log('[BOOK] Attempt:', { sessionToken, slotId });

    // 1. Load assessment
    const { data: session, error: sessErr } = await supabaseAdmin
      .from('consultant_assessment_sessions')
      .select('id, phone, full_name, phone_verified, report_generated')
      .eq('session_token', sessionToken)
      .single();

    if (sessErr || !session) { console.log('[BOOK] FAIL: session not found', sessErr?.message); return badRequest('Assessment session not found.'); }
    if (!session.phone_verified) { console.log('[BOOK] FAIL: phone not verified'); return badRequest('Phone number not verified.'); }
    if (!session.report_generated) { console.log('[BOOK] FAIL: report not generated'); return badRequest('Assessment report must be generated before booking.'); }

    // 1b. Check user doesn't already have a confirmed (uncompleted) booking
    const { count: existingBookings } = await supabaseAdmin
      .from('consultant_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session.id)
      .eq('status', 'confirmed');
    if ((existingBookings || 0) > 0) {
      console.log('[BOOK] FAIL: already has confirmed booking');
      return badRequest('You already have a confirmed consultation. Please complete it before booking another.');
    }

    // 2. Lock and claim the slot atomically
    const { data: updatedSlot, error: slotErr } = await supabaseAdmin
      .from('consultant_slots')
      .update({ status: 'booked' })
      .eq('id', slotId)
      .eq('status', 'available')
      .gt('start_time', new Date().toISOString())
      .select('id, consultant_id, slot_date, start_time, end_time, duration_mins')
      .single();

    if (slotErr || !updatedSlot) {
      const { data: check } = await supabaseAdmin
        .from('consultant_slots')
        .select('id, status, start_time')
        .eq('id', slotId)
        .single();

      if (!check) { console.log('[BOOK] FAIL: slot not found in DB'); return badRequest('Slot not found.'); }
      if (check.status !== 'available') { console.log('[BOOK] FAIL: slot status is', check.status); return conflict('This time was just booked. Please select another available slot.'); }
      console.log('[BOOK] FAIL: slot start_time in past?', check.start_time);
      return badRequest('This slot is no longer bookable.');
    }

    // 3. Create booking
    const { data: booking, error: bookErr } = await supabaseAdmin
      .from('consultant_bookings')
      .insert({
        slot_id: slotId,
        consultant_id: updatedSlot.consultant_id,
        session_id: session.id,
        phone: session.phone,
        full_name: session.full_name,
        status: 'confirmed',
      })
      .select()
      .single();

    if (bookErr) {
      await supabaseAdmin.from('consultant_slots').update({ status: 'available' }).eq('id', slotId);
      throw bookErr;
    }

    broadcastSlotUpdate({
      type: 'slot_booked',
      payload: {
        slot_id: slotId,
        booking_id: booking.id,
        start_time: updatedSlot.start_time,
        end_time: updatedSlot.end_time,
      },
      timestamp: new Date().toISOString(),
    });

    // Async webhook — failure does not rollback booking
    sendBookingToWebhook(booking).catch(e => console.error('[Webhook] booking send failed:', e?.message));

    // WhatsApp confirmation failure should not rollback the booking, but in serverless
    // we must await the attempt so the runtime does not end before WATI is called.
    const slotDate = new Date(updatedSlot.slot_date + 'T00:00:00+05:30');
    const formattedDate = slotDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
    const watiSent = await sendBookingConfirmation(session.phone, session.full_name, formattedDate, fmt(updatedSlot.start_time), fmt(updatedSlot.end_time));
    if (!watiSent) console.error('[WATI] Booking confirmation was not sent.');

    return ok({
      booking_id: booking.id,
      slot: {
        id: updatedSlot.id,
        date: updatedSlot.slot_date,
        startsAt: updatedSlot.start_time,
        endsAt: updatedSlot.end_time,
        durationMinutes: updatedSlot.duration_mins,
      },
      message: 'Consultation booked successfully!',
    });
  } catch (err) {
    return serverError(err);
  }
}
