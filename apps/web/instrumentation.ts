import { startTracing } from '@hbcu-band-hub/observability';

export async function register() {
  startTracing('web');
}
