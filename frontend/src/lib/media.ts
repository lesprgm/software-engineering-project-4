import { getRuntimeEnv } from './env';

const env = getRuntimeEnv();

// Use Vite base URL to ensure correct path in dev/preview/build
export const DEFAULT_AVATAR = `${env.BASE_URL || '/'}avatar-default.svg`;
