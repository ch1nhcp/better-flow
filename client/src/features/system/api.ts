import { apiRequest } from '../../lib/api';

export interface HealthResponse {
  data: { status: 'ok'; service: 'betterflow-api' };
}

export const getHealth = () => apiRequest<HealthResponse>('/health');
