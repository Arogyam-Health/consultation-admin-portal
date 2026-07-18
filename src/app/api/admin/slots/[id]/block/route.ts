import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth/jwt';
import { ok, badRequest, notFound, serverError } from '@/lib/api/response';
import { broadcastSlotUpdate } from '@/lib/websocket/server';

const BlockSchema = z.object({ reason: z.string().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = BlockSchema.safeParse(body);

    const { data: slot } = await supabaseAdmin
      .from('consultant_slots')
      .select('id, status')
      .eq('id', id)
      .single();

    if (!slot) return notFound('Slot not found');
    if (slot.status === 'booked') return badRequest('Cannot block a booked slot');

    const { data, error } = await supabaseAdmin
      .from('consultant_slots')
      .update({ status: 'blocked', blocked_reason: parsed.success ? parsed.data.reason : undefined })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    broadcastSlotUpdate({ type: 'slot_blocked', payload: data, timestamp: new Date().toISOString() });
    return ok(data);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await params;

    const { data: slot } = await supabaseAdmin
      .from('consultant_slots')
      .select('id, status')
      .eq('id', id)
      .single();

    if (!slot) return notFound('Slot not found');
    if (slot.status === 'booked') return badRequest('Cannot delete a booked slot');

    // If blocked, unblock instead of delete
    if (slot.status === 'blocked') {
      const { data, error } = await supabaseAdmin
        .from('consultant_slots')
        .update({ status: 'available', blocked_reason: null })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      broadcastSlotUpdate({ type: 'slot_updated', payload: data, timestamp: new Date().toISOString() });
      return ok(data);
    }

    const { error } = await supabaseAdmin.from('consultant_slots').delete().eq('id', id);
    if (error) throw error;

    broadcastSlotUpdate({ type: 'slot_released', payload: { id }, timestamp: new Date().toISOString() });
    return ok({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
