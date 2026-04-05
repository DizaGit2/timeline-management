/// <reference types="vite/client" />
import axios from "axios";

const BASE_URL =
  (import.meta as ImportMeta & { env: Record<string, string> }).env
    ?.VITE_API_URL ?? "";

let tokenGetter: (() => string | null) | null = null;

export function setTokenGetter(getter: () => string | null): void {
  tokenGetter = getter;
}

export function getToken(): string | null {
  return tokenGetter?.() ?? null;
}

export const axiosInstance = axios.create({ baseURL: BASE_URL });

axiosInstance.interceptors.request.use((config) => {
  const token = tokenGetter?.() ?? null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
