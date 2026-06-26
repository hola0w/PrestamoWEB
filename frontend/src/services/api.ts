// Forzamos la URL de Render como BASE_URL absoluta para los reportes
const BASE_URL = "https://prestamoweb.onrender.com/api";

function getToken(): string | null {
  try {
    const session = localStorage.getItem("auth_session");
    return session ? JSON.parse(session).token : null;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

    if (!res.ok) {
      // Manejo específico si el token venció (401) o no tiene permisos (403)
      if (res.status === 401 || res.status === 403) {
        window.dispatchEvent(new CustomEvent("auth:expired"));
        throw new Error("Tu sesión ha expirado. Por favor, inicia sesión nuevamente.");
      }

      const body = await res.json().catch(() => ({ error: "Error interno del servidor" }));
      throw new Error(body.error ?? `Error en el servidor (Código ${res.status})`);
    }

    if (res.status === 204) return undefined as unknown as T;
    return res.json() as Promise<T>;
    
  } catch (error: any) {
    // Si falla por Red (Fetch Error), lo más probable es que Render esté "despertando"
    if (error.message === "Failed to fetch" || error.name === "TypeError") {
      throw new Error("El servidor de Render está despertando o no hay conexión a internet. Por favor, espera 30 segundos e intenta de nuevo.");
    }
    throw error;
  }
}

export const api = {
  get:    <T>(path: string)                => request<T>(path),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: "POST",   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => request<T>(path, { method: "PUT",    body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH",  body: JSON.stringify(body) }),
  delete: <T>(path: string)                => request<T>(path, { method: "DELETE" }),
};