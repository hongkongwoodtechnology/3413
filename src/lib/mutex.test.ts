import { withMatchLock } from '@/lib/mutex';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('withMatchLock', () => {
  it('serializes execution for the same matchId', async () => {
    const order: string[] = [];

    const taskA = withMatchLock('match-1', async () => {
      order.push('a-start');
      await delay(10);
      order.push('a-end');
    });

    const taskB = withMatchLock('match-1', async () => {
      order.push('b-start');
      await delay(5);
      order.push('b-end');
    });

    await Promise.all([taskA, taskB]);

    expect(order).toEqual(['a-start', 'a-end', 'b-start', 'b-end']);
  });

  it('does not block different matchIds', async () => {
    const order: string[] = [];

    const taskA = withMatchLock('match-1', async () => {
      order.push('a-start');
      await delay(10);
      order.push('a-end');
    });

    const taskB = withMatchLock('match-2', async () => {
      order.push('b-start');
      await delay(5);
      order.push('b-end');
    });

    await Promise.all([taskA, taskB]);

    expect(order).toEqual(['a-start', 'b-start', 'b-end', 'a-end']);
  });

  it('returns the result of the wrapped function', async () => {
    const result = await withMatchLock('match-3', async () => 42);

    expect(result).toBe(42);
  });

  it('releases the lock even when the wrapped function throws', async () => {
    await expect(
      withMatchLock('match-4', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    const order: string[] = [];
    await withMatchLock('match-4', async () => {
      order.push('after-error');
    });

    expect(order).toEqual(['after-error']);
  });
});
