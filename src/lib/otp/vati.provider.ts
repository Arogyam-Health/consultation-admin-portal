import axios from 'axios';
import type { OtpProvider, OtpSendResult } from './provider';

export class VatiOtpProvider implements OtpProvider {
  readonly name = 'wati';

  private readonly baseUrl: string;
  private readonly token: string;
  private readonly templateName: string;
  private readonly broadcastName: string;

  constructor() {
    this.baseUrl = process.env.WATI_API_BASE_URL || '';
    this.token = process.env.WATI_ACCESS_TOKEN || '';
    this.templateName = process.env.WATI_OTP_TEMPLATE_NAME || 'otp_consultation';
    this.broadcastName = process.env.WATI_BROADCAST_NAME || 'otp_consultation';

    if (!this.baseUrl || !this.token) {
      throw new Error('WATI_API_BASE_URL and WATI_ACCESS_TOKEN must be set when OTP_PROVIDER=wati');
    }
  }

  async sendOtp(phone: string, otp: string): Promise<OtpSendResult> {
    const whatsappNumber = phone.replace(/^\+/, '');

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/sendTemplateMessage?whatsappNumber=${whatsappNumber}`,
        {
          template_name: this.templateName,
          broadcast_name: this.broadcastName,
          parameters: [{ name: '1', value: otp }],
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
        }
      );

      if (response.data?.result === true) {
        return { success: true, messageId: response.data?.info?.whatsappMessageId };
      }

      return {
        success: false,
        error: response.data?.info || 'WATI returned non-success result',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[WatiOtpProvider] Error sending OTP:', message);
      return { success: false, error: message };
    }
  }
}
