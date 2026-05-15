/**
 * @jest-environment node
 */

import { GET, POST } from './route';

const CURRENT_ADMIN_ADDRESS = '3veQRXa6347BofJAAGYrFuw2125E17P2LgAozCo7hXc2';
const RETIRED_ADMIN_ADDRESS = '2Ntk8UGJqPDVD977oDiYpsN1Y2RASWRjFVFFrAywSd5K';

describe('Referral API', () => {
    afterEach(() => {
        delete process.env.ADMIN_WALLET_ADDRESS;
        delete process.env.NEXT_PUBLIC_HOUSE_WALLET;
    });

    it('should return 400 if address is not provided in GET request', async () => {
        const req = new Request('http://localhost:3000/api/referral');
        const res = await GET(req);
        
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe('Address is required');
    });

    it('should return default data for a new address', async () => {
        const testAddress = '0xTest123';
        const req = new Request(`http://localhost:3000/api/referral?address=${testAddress}`);
        const res = await GET(req);
        
        expect(res.status).toBe(200);
        const json = await res.json();
        
        expect(json.data).toBeDefined();
        expect(json.data.stats).toBeDefined();
        expect(json.data.commissions).toBeDefined();
        expect(json.data.referees).toBeDefined();
        expect(json.data.balances).toBeDefined();
        
        // Assert some default mock data values
        expect(json.data.stats.friends).toBe(0);
        expect(json.data.commissions.length).toBe(0);
        expect(json.data.referees.length).toBe(0);
        expect(json.data.balances.bonus).toBe(0);
    });

    it('should add a new referee via POST request', async () => {
        const testAddress = '0xTest123';
        const newRefereeAddress = '0xNewUser456';
        
        const req = new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: testAddress, newRefereeAddress })
        });
        
        const res = await POST(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        
        expect(json.success).toBe(true);
        // Friends count should increase by 1 (0 -> 1)
        expect(json.data.stats.friends).toBe(1);
        // Referees array should have one more item (0 -> 1)
        expect(json.data.referees.length).toBe(1);
        // The first referee should be the newly added one
        expect(json.data.referees[0].address).toBe(newRefereeAddress);
        expect(json.data.referees[0].joinDateValue).toBe(0);
        expect(json.data.referees[0].rewardIssued).toBe(false);
    });

    it('should issue 100U bonus when referee volume reaches 1000U', async () => {
        const referrer = '0xReferrer';
        const referee = '0xRefereeThreshold';
        
        // 1. Bind referral
        await POST(new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: referrer, newRefereeAddress: referee })
        }));

        // 2. Place bet of 500U (Not enough for bonus)
        await POST(new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'place_bet', userAddress: referee, referrerAddress: referrer, betAmount: 500 })
        }));

        // Check balances (should be 0)
        let res = await GET(new Request(`http://localhost:3000/api/referral?address=${referee}`));
        let json = await res.json();
        expect(json.data.balances.bonus).toBe(0);

        // 3. Place another bet of 600U (Total = 1100U, should trigger bonus)
        await POST(new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'place_bet', userAddress: referee, referrerAddress: referrer, betAmount: 600 })
        }));

        // Check balances (should be 100)
        res = await GET(new Request(`http://localhost:3000/api/referral?address=${referee}`));
        json = await res.json();
        expect(json.data.balances.bonus).toBe(100);

        // Check referrer state (rewardIssued should be true)
        res = await GET(new Request(`http://localhost:3000/api/referral?address=${referrer}`));
        json = await res.json();
        const refRecord = json.data.referees.find((r: any) => r.address === referee);
        expect(refRecord.totalVolumeValue).toBe(1100);
        expect(refRecord.rewardIssued).toBe(true);

        // 4. Place another bet (Should NOT trigger bonus again)
        await POST(new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'place_bet', userAddress: referee, referrerAddress: referrer, betAmount: 5 })
        }));

        // Check balances (should still be 100)
        res = await GET(new Request(`http://localhost:3000/api/referral?address=${referee}`));
        json = await res.json();
        expect(json.data.balances.bonus).toBe(100); // Idempotency check passed
    });

    it('should NOT issue bonus if user has no referrer (independent account)', async () => {
        const independentUser = '0xIndependentUser';
        
        // Place a bet (but NO referrer provided, so no bonus eligible)
        await POST(new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'place_bet', 
                userAddress: independentUser, 
                // referrerAddress is omitted/null
                betAmount: 5 
            })
        }));

        // Check balances (should remain 0 because they have no referrer)
        const res = await GET(new Request(`http://localhost:3000/api/referral?address=${independentUser}`));
        const json = await res.json();
        expect(json.data.balances.bonus).toBe(0);
    });

    it('should return 400 if POST request misses parameters', async () => {
        const req = new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: '0xTest123' }) // Missing newRefereeAddress
        });
        
        const res = await POST(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe('Missing parameters');
    });

    it('allows the current admin wallet to airdrop bonus', async () => {
        const req = new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'airdrop_bonus',
                adminAddress: CURRENT_ADMIN_ADDRESS,
                targetAddress: '0xBonusTarget',
                amount: 25
            })
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.newBalance).toBe(25);
    });

    it('rejects a non-admin wallet for bonus airdrop', async () => {
        const req = new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'airdrop_bonus',
                adminAddress: 'NotAdmin1111111111111111111111111111111111',
                targetAddress: '0xBonusTarget2',
                amount: 10
            })
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(403);
        expect(json.error).toBe('Unauthorized');
    });

    it('rejects the retired admin wallet even when stale config references it', async () => {
        process.env.ADMIN_WALLET_ADDRESS = RETIRED_ADMIN_ADDRESS;

        const req = new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'airdrop_bonus',
                adminAddress: RETIRED_ADMIN_ADDRESS,
                targetAddress: '0xLegacyTarget',
                amount: 5
            })
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(403);
        expect(json.error).toBe('Unauthorized');
    });

    it('allows the current admin wallet to fetch leaderboard', async () => {
        await POST(new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: '0xLeaderReferrer',
                newRefereeAddress: '0xLeaderUser'
            })
        }));

        const req = new Request('http://localhost:3000/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get_leaderboard',
                adminAddress: CURRENT_ADMIN_ADDRESS
            })
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data)).toBe(true);
    });
});
