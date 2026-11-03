export type Bindings = {
  DB: D1Database;
  ASSETS?: Fetcher;
  KV_AUTH?: KVNamespace;
  JWT_SECRET?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  QSTASH_TOKEN?: string;
  QSTASH_CURRENT_SIGNING_KEY?: string;
  QSTASH_NEXT_SIGNING_KEY?: string;
  CRON_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  Mail_Pass?: any;
};

export type Variables = {
  userId: string;
  tokenScopes?: string[];
  authType?: 'jwt' | 'pat';
  actorType?: 'user' | 'agent' | 'collaborator';
  actorName?: string;
  vaultOwnerId?: string;
  vaultRole?: 'owner' | 'editor' | 'viewer';
};
