import {
  type CognitionProvider,
  type CognitionProviderResponse,
  type CognitionRequest,
  type CognitionTaskKind,
} from './cognitionProvider';

export type CloudTextCognitionExecutor = (
  request: CognitionRequest,
) => Promise<string | CognitionProviderResponse>;

export function createCloudTextCognitionProvider(options: {
  execute: CloudTextCognitionExecutor;
  id: string;
  maxContextTokens?: number | null;
  tasks: CognitionTaskKind[];
  version?: string;
}): CognitionProvider {
  return {
    descriptor: {
      capabilities: {
        cancellation: true,
        maxContextTokens: options.maxContextTokens ?? null,
        streaming: false,
        tasks: [...options.tasks],
      },
      id: options.id,
      kind: 'cloud-model',
      version: options.version ?? '1',
    },
    invoke: async (request) => {
      const response = await options.execute(request);
      return typeof response === 'string'
        ? { outputText: response }
        : response;
    },
  };
}
