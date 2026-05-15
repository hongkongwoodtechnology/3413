import { NextRequest, NextResponse } from 'next/server';
import { generateAdminChallenge, getAdminAddresses } from '@/lib/security/auth';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'address is required' }, { status: 400 });
  }

  const adminAddresses = getAdminAddresses();
  if (!adminAddresses.includes(address)) {
    return NextResponse.json({ error: 'not an admin address' }, { status: 403 });
  }

  const challenge = generateAdminChallenge();
  return NextResponse.json({ challenge });
}
