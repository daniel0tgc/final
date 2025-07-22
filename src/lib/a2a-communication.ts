// Minimal A2A log helper for UI
export async function getCrossAgentLogs(agentId: string): Promise<any[]> {
  const res = await fetch("/api/memory/get/a2a:messages");
  let log: any[] = [];
  try {
    const data = await res.json();
    log = Array.isArray(data.value)
      ? data.value
      : data.value
      ? [data.value]
      : [];
  } catch {}
  // Only return messages where agent is sender or receiver
  return log.filter((msg) => msg.from === agentId || msg.to === agentId);
}
