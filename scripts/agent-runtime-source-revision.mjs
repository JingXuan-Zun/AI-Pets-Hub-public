import { createAgentRuntimeSourceRevision } from './agentRuntimeSourceRevisionCore.mjs';

const result = createAgentRuntimeSourceRevision(process.cwd());
console.log(result.revision);
console.log(`files=${result.fileCount}`);
