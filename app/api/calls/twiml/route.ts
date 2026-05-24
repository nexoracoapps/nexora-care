import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const { VoiceResponse } = twilio.twiml;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const to = formData.get('To') as string;

  const twiml = new VoiceResponse();

  if (to) {
    const dial = twiml.dial({ callerId: process.env.TWILIO_PHONE_NUMBER });
    dial.number({}, to);
  } else {
    twiml.say('No destination number provided.');
  }

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
