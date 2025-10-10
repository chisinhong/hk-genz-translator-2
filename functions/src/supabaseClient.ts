export interface SupabaseClientConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  anonKey?: string;
  fetchImpl?: typeof fetch;
}

export interface SupabaseRpcOptions {
  accessToken?: string;
  signal?: AbortSignal;
}

export class SupabaseClient {
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly anonKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: SupabaseClientConfig) {
    const { supabaseUrl, serviceRoleKey, anonKey, fetchImpl } = config;

    if (!supabaseUrl) {
      throw new Error("Supabase URL is not configured.");
    }

    if (!serviceRoleKey) {
      throw new Error("Supabase service role key is not configured.");
    }

    const normalizedUrl = supabaseUrl.endsWith("/")
      ? supabaseUrl.slice(0, -1)
      : supabaseUrl;

    this.supabaseUrl = normalizedUrl;
    this.serviceRoleKey = serviceRoleKey;
    this.anonKey = anonKey;
    this.fetchImpl = fetchImpl ?? globalThis.fetch;

    if (typeof this.fetchImpl !== "function") {
      throw new Error("Fetch API is not available in the current runtime.");
    }
  }

  static fromEnv(overrides: Partial<SupabaseClientConfig> = {}): SupabaseClient {
    return new SupabaseClient({
      supabaseUrl:
        overrides.supabaseUrl ?? process.env.SUPABASE_URL ?? requireEnv("SUPABASE_URL"),
      serviceRoleKey:
        overrides.serviceRoleKey ??
        process.env.SUPABASE_SERVICE_ROLE_KEY ??
        requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      anonKey: overrides.anonKey ?? process.env.SUPABASE_ANON_KEY,
      fetchImpl: overrides.fetchImpl,
    });
  }

  async rpc<T>(
    functionName: string,
    params: Record<string, unknown> = {},
    options: SupabaseRpcOptions = {},
  ): Promise<T> {
    const { accessToken, signal } = options;

    const response = await this.fetchImpl(
      `${this.supabaseUrl}/rest/v1/rpc/${functionName}`,
      {
        method: "POST",
        headers: this.buildHeaders(accessToken),
        body: JSON.stringify(params),
        signal,
      },
    );

    if (!response.ok) {
      const errorText = await safelyReadBody(response);
      throw new Error(
        `Supabase RPC ${functionName} failed (${response.status}): ${errorText}`,
      );
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const data = (await response.json()) as T;
    return data;
  }

  private buildHeaders(accessToken?: string): Record<string, string> {
    const key = accessToken
      ? this.anonKey ?? this.serviceRoleKey
      : this.serviceRoleKey;

    const headers: Record<string, string> = {
      apikey: key,
      Authorization: `Bearer ${accessToken ?? key}`,
      "Content-Type": "application/json",
    };

    return headers;
  }
}

function safelyReadBody(response: Response): Promise<string> {
  return response
    .text()
    .catch(() => "[unreadable response body]");
}

function requireEnv(name: string): never {
  throw new Error(`Environment variable ${name} is required but was not provided.`);
}
