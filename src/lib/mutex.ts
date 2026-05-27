type AsyncFn<T> = () => Promise<T>;

const locks = new Map<string, Promise<void>>();

export async function withMatchLock<T>(matchId: string | number, fn: AsyncFn<T>): Promise<T> {
  const key = String(matchId);

  const previousLock = locks.get(key) || Promise.resolve();

  let release!: () => void;
  const newLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  locks.set(key, newLock);

  try {
    await previousLock;
    return await fn();
  } finally {
    release();
    if (locks.get(key) === newLock) {
      locks.delete(key);
    }
  }
}
