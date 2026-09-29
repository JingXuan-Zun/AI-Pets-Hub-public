import { useCallback, useEffect, useState } from 'react';
import { expressionLibraryBridge } from './expressionLibraryBridge';
import type { ExpressionLibraryResult, ExpressionLibraryState } from './expressionLibraryTypes';

export function useExpressionLibrary(enabled = true) {
  const [state, setState] = useState<ExpressionLibraryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const applyResult = useCallback((result: ExpressionLibraryResult) => {
    if (!result.ok) {
      setError(result.error || '表情包库操作失败。');
      return false;
    }
    if (result.state) setState(result.state);
    setError('');
    return true;
  }, []);

  const run = useCallback(async (action: () => Promise<ExpressionLibraryResult>) => {
    setLoading(true);
    try {
      const result = await action();
      applyResult(result);
      return result;
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : '表情包库操作失败。';
      setError(message);
      return { error: message, ok: false } satisfies ExpressionLibraryResult;
    } finally {
      setLoading(false);
    }
  }, [applyResult]);

  useEffect(() => {
    if (enabled) void run(expressionLibraryBridge.getState);
    else setLoading(false);
  }, [enabled, run]);

  return { error, loading, run, state };
}
