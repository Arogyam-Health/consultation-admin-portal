const ASSESSMENT_WEBHOOK_URL = process.env.ASSESSMENT_WEBHOOK_URL || '';
const BOOKING_WEBHOOK_URL = process.env.BOOKING_WEBHOOK_URL || '';

async function post(url: string, payload: unknown): Promise<void> {
  if (!url) {
    console.log('[Webhook] No URL configured — skipping.');
    return;
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error(`[Webhook] HTTP ${response.status}: ${await response.text().catch(() => '')}`);
    } else {
      console.log('[Webhook] Sent successfully.');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Webhook] Request failed:', msg);
  }
}

export async function sendAssessmentToWebhook(session: Record<string, unknown>): Promise<void> {
  await post(ASSESSMENT_WEBHOOK_URL, {
    event: 'assessment.completed',
    session_id: session.id,
    full_name: session.full_name,
    phone: session.phone,
    phone_verified: session.phone_verified,
    age: session.age,
    gender: session.gender,
    height: session.height_cm,
    current_weight: session.weight_kg,
    target_weight: session.target_weight_kg,
    bmi: session.bmi,
    barriers: session.barriers,
    lifestyle: session.lifestyle,
    digestive_health: session.digestive_health,
    medical_conditions: session.medical_conditions,
    eligibility: session.eligibility,
    motivation: session.motivation,
    report_generated: session.report_generated,
    created_at: session.created_at,
  });
}

export async function sendBookingToWebhook(booking: Record<string, unknown>): Promise<void> {
  await post(BOOKING_WEBHOOK_URL, {
    event: 'booking.confirmed',
    session_id: booking.session_id,
    full_name: booking.full_name,
    phone: booking.phone,
    consultation_date: booking.consultation_date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    booking_status: booking.status,
    booking_created_at: booking.created_at,
  });
}

export async function sendBookingToPabbly(booking: Record<string, unknown>, slot: Record<string, unknown>): Promise<void> {
  await post(process.env.PABBLY_BOOKING_WEBHOOK_URL || BOOKING_WEBHOOK_URL, {
    event: 'booking.confirmed',
    assessment_session_id: booking.session_id,
    full_name: booking.full_name,
    phone: booking.phone,
    consultation_date: slot.slot_date,
    consultation_start_time: slot.start_time,
    consultation_end_time: slot.end_time,
    booking_status: booking.status,
    booking_created_at: booking.created_at,
  });
}
