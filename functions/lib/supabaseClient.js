"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseClient = void 0;
class SupabaseClient {
    constructor(config) {
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
        this.fetchImpl = fetchImpl !== null && fetchImpl !== void 0 ? fetchImpl : globalThis.fetch;
        if (typeof this.fetchImpl !== "function") {
            throw new Error("Fetch API is not available in the current runtime.");
        }
    }
    static fromEnv(overrides = {}) {
        var _a, _b, _c, _d, _e;
        return new SupabaseClient({
            supabaseUrl: (_b = (_a = overrides.supabaseUrl) !== null && _a !== void 0 ? _a : process.env.SUPABASE_URL) !== null && _b !== void 0 ? _b : requireEnv("SUPABASE_URL"),
            serviceRoleKey: (_d = (_c = overrides.serviceRoleKey) !== null && _c !== void 0 ? _c : process.env.SUPABASE_SERVICE_ROLE_KEY) !== null && _d !== void 0 ? _d : requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
            anonKey: (_e = overrides.anonKey) !== null && _e !== void 0 ? _e : process.env.SUPABASE_ANON_KEY,
            fetchImpl: overrides.fetchImpl,
        });
    }
    async rpc(functionName, params = {}, options = {}) {
        const { accessToken, signal } = options;
        const response = await this.fetchImpl(`${this.supabaseUrl}/rest/v1/rpc/${functionName}`, {
            method: "POST",
            headers: this.buildHeaders(accessToken),
            body: JSON.stringify(params),
            signal,
        });
        if (!response.ok) {
            const errorText = await safelyReadBody(response);
            throw new Error(`Supabase RPC ${functionName} failed (${response.status}): ${errorText}`);
        }
        if (response.status === 204) {
            return undefined;
        }
        const data = (await response.json());
        return data;
    }
    buildHeaders(accessToken) {
        var _a;
        const key = accessToken
            ? (_a = this.anonKey) !== null && _a !== void 0 ? _a : this.serviceRoleKey
            : this.serviceRoleKey;
        const headers = {
            apikey: key,
            Authorization: `Bearer ${accessToken !== null && accessToken !== void 0 ? accessToken : key}`,
            "Content-Type": "application/json",
        };
        return headers;
    }
}
exports.SupabaseClient = SupabaseClient;
function safelyReadBody(response) {
    return response
        .text()
        .catch(() => "[unreadable response body]");
}
function requireEnv(name) {
    throw new Error(`Environment variable ${name} is required but was not provided.`);
}
//# sourceMappingURL=supabaseClient.js.map