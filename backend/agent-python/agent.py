import os
import json
import base64
import time
from fastapi import FastAPI, Request
import redis
import uvicorn
import requests

app = FastAPI()

AGENT_ID = os.environ.get('AGENT_ID', 'unknown')
AGENT_CONFIG = json.loads(base64.b64decode(os.environ.get('AGENT_CONFIG', '')).decode('utf-8')) if os.environ.get('AGENT_CONFIG') else {}
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')

r = redis.Redis.from_url(REDIS_URL, decode_responses=True)

agent_context = AGENT_CONFIG.get('systemPrompt', '')
agent_tools = AGENT_CONFIG.get('tools', [])

@app.post('/message')
async def message_endpoint(req: Request):
    data = await req.json()
    message = data.get('message')
    if not message:
        return {"error": "Missing message"}

    # Store message in shared memory (Redis)
    r.lpush(f"agent:{AGENT_ID}:messages", json.dumps({
        'role': 'user', 'content': message, 'timestamp': int(time.time())
    }))

    # Retrieve last 10 messages
    history = [json.loads(x) for x in r.lrange(f"agent:{AGENT_ID}:messages", 0, 9)]

    # TODO: Tool usage, LLM call, etc. For now, mock response
    response = {
        'role': 'agent',
        'content': f"Echo: {message}\nContext: {agent_context}\nTools: {', '.join([t.get('name', '') for t in agent_tools])}",
        'timestamp': int(time.time()),
        'memory': history
    }

    # Store agent response in memory
    r.lpush(f"agent:{AGENT_ID}:messages", json.dumps(response))

    return response

@app.post('/fact/set')
async def set_fact(req: Request):
    data = await req.json()
    key = data.get('key')
    value = data.get('value')
    if not key or value is None:
        return {"error": "Missing key or value"}
    try:
        backend_url = os.environ.get('BACKEND_URL', 'http://host.docker.internal:4000')
        resp = requests.post(f"{backend_url}/api/longterm/set", json={
            'agentId': AGENT_ID,
            'key': key,
            'value': value
        })
        resp.raise_for_status()
        return {"status": "ok"}
    except Exception as e:
        return {"error": str(e)}

@app.get('/fact/get/{key}')
async def get_fact(key: str):
    try:
        backend_url = os.environ.get('BACKEND_URL', 'http://host.docker.internal:4000')
        resp = requests.get(f"{backend_url}/api/longterm/get/{AGENT_ID}/{key}")
        resp.raise_for_status()
        data = resp.json()
        return {"value": data.get('value')}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
