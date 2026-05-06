import { NextResponse } from 'next/server';
import { getUSDTBalance } from '@/lib/solana';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');

        console.log(`[API Balance] Received request for address: ${address}`);

        if (!address) {
            return NextResponse.json({ error: 'Address is required' }, { status: 400 });
        }

        const balance = await getUSDTBalance(address);
        console.log(`[API Balance] Final fetched balance for ${address}: ${balance}`);
        
        return NextResponse.json({ 
            success: true, 
            address,
            balance 
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        });
    } catch (error) {
        console.error("[API Balance] Error fetching balance:", error);
        return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 });
    }
}
