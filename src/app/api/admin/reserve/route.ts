import { NextResponse } from 'next/server';
import { loadReserve } from '@/lib/reserve';

export async function GET() {
  try {
    const data = loadReserve();
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('Reserve API Error:', error);
    return NextResponse.json({ error: 'Failed to load reserve' }, { status: 500 });
  }
}
