import axios from 'axios';

const baseUrl = process.env.WATI_API_BASE_URL || '';
const token = process.env.WATI_ACCESS_TOKEN || '';

function getConfig() {
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
}

async function sendTemplateMessage(phone: string, templateName: string, broadcastName: string | undefined, params: { name: string; value: string }[]): Promise<boolean> {
  const config = getConfig();
  if (!config) {
    console.log('[WATI] Not configured — skipping template message.');
    return false;
  }

  const whatsappNumber = phone.replace(/^\+/, '');
  console.log(`[WATI] Sending to: ${whatsappNumber} (raw: ${phone})`);
  const body: Record<string, unknown> = {
    template_name: templateName,
    broadcast_name: broadcastName || templateName,
    parameters: params,
  };

  try {
    const response = await axios.post(
      `${config.baseUrl}/api/v1/sendTemplateMessage?whatsappNumber=${whatsappNumber}`,
      body,
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      }
    );

    if (response.data?.result === true) {
      console.log(`[WATI] Template "${templateName}" sent to ${phone}`);
      return true;
    }

    console.error(`[WATI] Template "${templateName}" failed:`, JSON.stringify(response.data));
    return false;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response) {
      console.error(`[WATI] Template "${templateName}" HTTP ${err.response.status}:`, JSON.stringify(err.response.data));
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[WATI] Template "${templateName}" error:`, msg);
    }
    return false;
  }
}

export async function sendBookingConfirmation(
  phone: string,
  name: string,
  date: string,
  startTime: string,
  endTime: string,
): Promise<boolean> {
  const templateName = process.env.WATI_BOOKING_TEMPLATE_NAME || 'consultation_confirmed';

  return sendTemplateMessage(phone, templateName, undefined, [
    { name: 'name', value: name },
    { name: 'date', value: date },
    { name: 'start_time', value: startTime },
    { name: 'end_time', value: endTime },
  ]);
}
