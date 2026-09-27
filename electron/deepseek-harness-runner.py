import json
import os
import sys
from deepseek_harness import DeepSeekHarness

request = json.loads(sys.stdin.read() or '{}')
try:
    patch_path = os.environ.get('DSH_CAPABILITY_PROFILE_PATCH', '').strip()
    with DeepSeekHarness(
        provider='deepseek-official',
        model=os.environ.get('DSH_MODEL', 'deepseek-v4-flash'),
        cwd=os.environ['DSH_WORKSPACE'],
        dsh_home=os.environ['DSH_HOME'],
        profile='sdk-minimal',
        patches=(patch_path,) if patch_path else (),
        env={
            'AI_PETS_HARNESS_BRIDGE_TOKEN': os.environ['AI_PETS_HARNESS_BRIDGE_TOKEN'],
            'AI_PETS_HARNESS_BRIDGE_URL': os.environ['AI_PETS_HARNESS_BRIDGE_URL'],
        },
    ) as harness:
        result = harness.run(request.get('goal', ''), session_id=os.environ.get('DSH_SESSION_ID'))
    print(json.dumps({'finalResponse': result.final_response}, ensure_ascii=False))
except Exception as error:
    print(json.dumps({'error': str(error)}, ensure_ascii=False))
    sys.exit(1)
