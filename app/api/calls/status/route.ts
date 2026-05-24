import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const callSid = formData.get('CallSid') as string;
  const callStatus = formData.get('CallStatus') as string;
  const duration = formData.get('CallDuration') as string;

  if (!callSid) return new NextResponse('OK', { status: 200 });

  const durationSeconds = duration ? parseInt(duration, 10) : null;
  const status = callStatus === 'completed' ? 'COMPLETED'
    : callStatus === 'no-answer' ? 'NO_ANSWER'
    : callStatus === 'busy' ? 'NO_ANSWER'
    : 'CANCELLED';

  // Update the log entry that was saved with this callSid in notes
  await prisma.callLog.updateMany({
    where: { notes: callSid },
    data: {
      durationSeconds,
      status,
      endedAt: new Date(),
    },
  });

  return new NextResponse('OK', { status: 200 });
}
