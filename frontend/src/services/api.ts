export type HealthResult = { status: string; project: string; phase: number };
const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const baseUrl = (configuredUrl || 'http://localhost:8000').replace(/\/$/, '');
export async function getApiHealth(signal?: AbortSignal): Promise<HealthResult> {
  const response = await fetch(`${baseUrl}/api/v1/health`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
  return (await response.json()) as HealthResult;
}
