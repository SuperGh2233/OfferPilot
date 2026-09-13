/**
 * Supabase 网关偶发返回 408/429/502/503/504（生产 Smoke 实测约 10% 请求失败）。
 * 该包装为所有服务端 Supabase 请求提供单次尝试超时与带退避的重试：
 * - 读操作天然幂等；
 * - 训练写操作按合同幂等（Start 复用未结 Attempt、Complete 按 attemptId 读取）；
 * - 仅重试网关类状态码与网络错误，认证/校验类 4xx 不重试。
 */

const RETRYABLE_STATUS_CODES: ReadonlySet<number> = new Set([408, 429, 502, 503, 504]);
const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [300, 900];
const DEFAULT_TIMEOUT_MS = 8_000;

function isReplayableBody(body: unknown): boolean {
  return (
    body === undefined
    || body === null
    || typeof body === "string"
    || body instanceof Uint8Array
    || body instanceof ArrayBuffer
  );
}

export interface ResilientFetchOptions {
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
}

export function createResilientFetch(
  fetchImpl: typeof fetch = fetch,
  options: ResilientFetchOptions = {},
): typeof fetch {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;

  return async function resilientFetch(input, init) {
    const canReplay = !init || isReplayableBody(init.body);
    const attempts = canReplay ? retryDelaysMs.length + 1 : 1;
    let lastFailure: unknown = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (attempt > 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt - 2]));
      }
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const requestInit: RequestInit = init
        ? {
            ...init,
            signal: init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal,
          }
        : { signal: timeoutSignal };

      try {
        const response = await fetchImpl(input, requestInit);
        if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === attempts) {
          return response;
        }
        // 释放连接后再重试；保留最终一次的原始响应供上层生成常规错误。
        lastFailure = new Error(`Supabase gateway returned ${response.status}.`);
        void response.body?.cancel().catch(() => undefined);
      } catch (error) {
        lastFailure = error;
        if (attempt === attempts) throw error;
      }
    }

    throw lastFailure;
  };
}
