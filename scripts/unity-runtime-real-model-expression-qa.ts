import {
  parseUnityExpressionQaOptions,
} from './unity-runtime-real-model-expression-qa-config';
import {
  resolveUnityExpressionQaModelPath,
  runUnityExpressionQaPreflight,
} from './unity-runtime-real-model-expression-qa-preflight';
import {
  runUnityExpressionRealRuntimeQa,
} from './unity-runtime-real-model-expression-qa-runtime';

async function main() {
  const options = parseUnityExpressionQaOptions(process.argv.slice(2));
  const modelPath = await resolveUnityExpressionQaModelPath(options);
  await runUnityExpressionQaPreflight(options, modelPath);
  if (options.launchRuntime) {
    await runUnityExpressionRealRuntimeQa(options, modelPath);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
