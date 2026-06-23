import { useState, useEffect, useCallback, createContext, useContext } from "react";

// ── Módulos del sistema ───────────────────────────────────────
export type Modulo =
  | "dashboard"
  | "clientes"
  | "prestamos"
  | "cxc"
  | "cobros"
  | "reportes"
  | "sucursales"
  | "usuarios";

export const MODULOS_INFO: Record<Modulo, { label: string; icon: string; descripcion: string; ruta: string }> = {
  dashboard:  { label: "Dashboard",          icon: "🏠", descripcion: "Resumen general del sistema",        ruta: "/dashboard"   },
  clientes:   { label: "Clientes",           icon: "👥", descripcion: "Ver, crear y editar clientes",       ruta: "/clientes"    },
  prestamos:  { label: "Préstamos",          icon: "💳", descripcion: "Gestionar préstamos activos",        ruta: "/prestamos"   },
  cxc:        { label: "Cuentas por Cobrar", icon: "📋", descripcion: "Ver y registrar cobros de cuotas",   ruta: "/cxc"         },
  cobros:     { label: "Historial Cobros",   icon: "💰", descripcion: "Ver historial de cobros",            ruta: "/cobros"      },
  reportes:   { label: "Reportes",           icon: "📊", descripcion: "Acceso a reportes y estadísticas",   ruta: "/reportes"    },
  sucursales: { label: "Sucursales",         icon: "🏢", descripcion: "Gestionar sucursales de la empresa", ruta: "/sucursales"  },
  usuarios:   { label: "Usuarios",           icon: "🔧", descripcion: "Gestionar usuarios del sistema",     ruta: "/usuarios"    },
};

// ── Tipos ─────────────────────────────────────────────────────
export interface UsuarioAuth {
  id:             string;
  nombre:         string;
  username:       string;
  // CORREGIDO: el enum real rol_usuario en la DB es {ADMINISTRADOR, ESTANDAR}.
  // (verificado con SELECT enum_range(NULL::rol_usuario))
  rol:            "ADMINISTRADOR" | "ESTANDAR";
  estado:         "ACTIVO" | "INACTIVO" | "BLOQUEADO";
  permisos:       Modulo[];
  // Empresa a la que pertenece el usuario. Puede ser null — por ejemplo
  // un administrador global no necesita estar atado a una empresa.
  empresaId:      string | null;
  empresaNombre:  string | null;
}

interface AuthState {
  usuario: UsuarioAuth | null;
  token:   string | null;
}

interface AuthContextValue extends AuthState {
  loading:    boolean;
  login:      (username: string, password: string) => Promise<void>;
  logout:     () => void;
  puedeVer:   (modulo: Modulo) => boolean;
  esAdmin:    boolean;
  // true si el usuario es ESTANDAR y aún no tiene empresa asignada.
  // Los administradores nunca quedan bloqueados por esto.
  sinEmpresa: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "auth_session";

// ── Provider ──────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state,   setState]   = useState<AuthState>({ usuario: null, token: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AuthState;
        if (parsed.token && parsed.usuario) setState(parsed);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Credenciales inválidas");

    const newState: AuthState = { token: data.token, usuario: data.usuario };
    setState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  }, []);

  const logout = useCallback(() => {
    setState({ usuario: null, token: null });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const esAdmin = state.usuario?.rol === "ADMINISTRADOR";

  // CORREGIDO: el bloqueo por falta de empresa solo aplica a usuarios
  // ESTANDAR. Un ADMINISTRADOR puede no tener empresa_id (admin global)
  // y debe seguir viendo todo.
  const sinEmpresa = !!state.usuario && !esAdmin && state.usuario.empresaId == null;

  const puedeVer = useCallback(
    (modulo: Modulo): boolean => {
      if (!state.usuario) return false;
      if (esAdmin)         return true; // admin ve todo, sin excepción
      if (sinEmpresa)      return modulo === "dashboard";
      if (modulo === "dashboard") return true; // dashboard visible para todos

      return state.usuario.permisos.includes(modulo);
    },
    [state.usuario, esAdmin, sinEmpresa]
  );

  return (
    <AuthContext.Provider value={{ ...state, loading, login, logout, puedeVer, esAdmin, sinEmpresa }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}