import React, { useState, useEffect, useMemo } from "react";
import { useAuth, MODULOS_INFO, type Modulo } from "../hooks/useAuth";

// ── Tipos ─────────────────────────────────────────────────────
interface Usuario {
  id:         string;
  nombre:     string;
  username:   string;
  rol:        "ADMINISTRADOR" | "ESTANDAR";
  estado:     "ACTIVO" | "INACTIVO";
  permisos:   Modulo[];
  fecha_crea: string;
  fecha_act:  string;
}

// Módulos asignables a ESTANDAR (nunca "usuarios")
const MODULOS_ASIGNABLES: Modulo[] = [
  "clientes", "prestamos", "cxc", "cobros", "reportes",
];

function fmtFecha(f: string | null) {
  if (!f) return "—";
  return new Date(f).toLocaleDateString("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Helpers API ───────────────────────────────────────────────
function useApiHeaders() {
  const { token } = useAuth();
  return {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${token}`,
  };
}

// ── Selector visual de permisos ───────────────────────────────
function PermisosPicker({
  seleccionados,
  onChange,
}: {
  seleccionados: Modulo[];
  onChange:      (v: Modulo[]) => void;
}) {
  const toggle = (m: Modulo) =>
    onChange(
      seleccionados.includes(m)
        ? seleccionados.filter((x) => x !== m)
        : [...seleccionados, m]
    );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
      {MODULOS_ASIGNABLES.map((m) => {
        const info   = MODULOS_INFO[m];
        const activo = seleccionados.includes(m);
        return (
          <label
            key={m}
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          "10px",
              padding:      "10px 12px",
              borderRadius: "var(--radius-md)",
              border:       `1.5px solid ${activo ? "var(--brand)" : "var(--border)"}`,
              background:   activo ? "var(--brand-light)" : "var(--bg-2)",
              cursor:       "pointer",
              transition:   "all 0.15s",
              userSelect:   "none",
            }}
          >
            <input
              type="checkbox"
              checked={activo}
              onChange={() => toggle(m)}
              style={{ accentColor: "var(--brand)", width: "15px", height: "15px" }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize:   "0.82rem",
                fontWeight: activo ? 600 : 400,
                color:      activo ? "var(--brand)" : "var(--text-1)",
                display:    "flex",
                gap:        "5px",
                alignItems: "center",
              }}>
                {info.icon} {info.label}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: "1px" }}>
                {info.descripcion}
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

// ── Formulario crear / editar ─────────────────────────────────
interface FormProps {
  inicial?:   Usuario | null;
  headers:    Record<string, string>;
  onGuardar:  () => void;
  onCancelar: () => void;
}

function FormUsuario({ inicial, headers, onGuardar, onCancelar }: FormProps) {
  const esNuevo = !inicial;

  const [nombre,   setNombre]   = useState(inicial?.nombre   ?? "");
  const [username, setUsername] = useState(inicial?.username ?? "");
  const [estado,   setEstado]   = useState<"ACTIVO" | "INACTIVO">(inicial?.estado ?? "ACTIVO");
  const [permisos, setPermisos] = useState<Modulo[]>(inicial?.permisos ?? []);
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // Auto-generar username a partir del nombre
  const handleNombreChange = (v: string) => {
    setNombre(v);
    if (esNuevo) {
      setUsername(v.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (esNuevo && !password)             { setError("La contraseña es obligatoria."); return; }
    if (password && password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (permisos.length === 0)            { setError("Selecciona al menos un módulo de acceso."); return; }

    setSaving(true);
    try {
      const body: any = { nombre, username, estado, permisos };
      if (password) body.password = password;

      const url    = esNuevo ? "/api/usuarios" : `/api/usuarios/${inicial!.id}`;
      const method = esNuevo ? "POST" : "PATCH";

      const res  = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");

      onGuardar();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body" style={{ maxHeight: "72vh", overflowY: "auto" }}>
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>{error}</div>
        )}

        {/* Nombre completo */}
        <div className="form-group">
          <label className="form-label" htmlFor="u-nombre">Nombre completo</label>
          <input
            id="u-nombre" className="form-input" type="text"
            value={nombre} onChange={(e) => handleNombreChange(e.target.value)}
            placeholder="ej. Juan Pérez" required autoFocus
          />
        </div>

        {/* Username */}
        <div className="form-group">
          <label className="form-label" htmlFor="u-username">Nombre de usuario</label>
          <input
            id="u-username" className="form-input" type="text"
            value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="ej. juan.perez" required
            readOnly={!esNuevo}
            style={!esNuevo ? { background: "var(--bg-2)", color: "var(--text-3)" } : {}}
          />
          {esNuevo && (
            <span style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: "4px", display: "block" }}>
              Se usa para iniciar sesión. Solo letras, números y puntos.
            </span>
          )}
        </div>

        {/* Contraseña */}
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="form-group">
            <label className="form-label">
              {esNuevo ? "Contraseña" : "Nueva contraseña (opcional)"}
            </label>
            <input
              className="form-input" type="password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={esNuevo ? "Mínimo 6 caracteres" : "Dejar vacío para no cambiar"}
              minLength={password ? 6 : undefined}
              required={esNuevo}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirmar contraseña</label>
            <input
              className="form-input" type="password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repetir contraseña"
              required={!!password}
            />
          </div>
        </div>

        {/* Estado (solo en edición) */}
        {!esNuevo && (
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select
              className="form-select"
              value={estado}
              onChange={(e) => setEstado(e.target.value as "ACTIVO" | "INACTIVO")}
              aria-label="Estado del usuario"
            >
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
          </div>
        )}

        {/* Permisos */}
        <div className="form-group">
          <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            Módulos de acceso
            <span style={{
              fontSize: "0.72rem", background: "var(--brand-light)",
              color: "var(--brand)", borderRadius: "99px",
              padding: "1px 8px", fontWeight: 600,
            }}>
              {permisos.length} seleccionados
            </span>
          </label>
          <PermisosPicker seleccionados={permisos} onChange={setPermisos} />
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onCancelar} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Guardando..." : esNuevo ? "Crear usuario" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────
function Modal({
  titulo, onClose, children,
}: {
  titulo: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: "560px" }}>
        <div className="modal-header">
          <span className="modal-title">{titulo}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export function UsuarioToolPage() {
  const headers = useApiHeaders();

  const [usuarios,     setUsuarios]     = useState<Usuario[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [modal,        setModal]        = useState<"nuevo" | "editar" | null>(null);
  const [editando,     setEditando]     = useState<Usuario | null>(null);
  const [confirmId,    setConfirmId]    = useState<string | null>(null);
  const [busqueda,     setBusqueda]     = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | "ACTIVO" | "INACTIVO">("TODOS");

  // ── Cargar usuarios ─────────────────────────────────────────
  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/usuarios", { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al cargar");
      setUsuarios(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  // ── Filtrado ────────────────────────────────────────────────
  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (q && !u.nombre.toLowerCase().includes(q) && !u.username.toLowerCase().includes(q)) return false;
      if (filtroEstado !== "TODOS" && u.estado !== filtroEstado) return false;
      return true;
    });
  }, [usuarios, busqueda, filtroEstado]);

  // ── Desactivar / Activar ────────────────────────────────────
  const toggleEstado = async (u: Usuario) => {
    const endpoint = u.estado === "ACTIVO"
      ? `/api/usuarios/${u.id}/desactivar`
      : `/api/usuarios/${u.id}/activar`;
    try {
      const res  = await fetch(endpoint, { method: "PATCH", headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setConfirmId(null);
      cargar();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  };

  // ── Stats ───────────────────────────────────────────────────
  const activos           = usuarios.filter((u) => u.estado === "ACTIVO").length;
  const inactivos         = usuarios.filter((u) => u.estado === "INACTIVO").length;
  const usuarioAConfirmar = usuarios.find((u) => u.id === confirmId);

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <span className="topbar-title">🔧 Gestión de usuarios</span>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={cargar} disabled={loading}>
            {loading ? "Actualizando..." : "↻ Actualizar"}
          </button>
          <button className="btn btn-primary" onClick={() => { setEditando(null); setModal("nuevo"); }}>
            + Nuevo usuario
          </button>
        </div>
      </div>

      <div className="page">

        {/* Aviso */}
        <div style={{
          background: "var(--brand-light)", border: "1px solid #c3d7fc",
          borderRadius: "var(--radius-md)", padding: "0.75rem 1rem",
          fontSize: "0.82rem", color: "var(--brand)",
          marginBottom: "1.5rem", display: "flex", gap: "8px",
        }}>
          <span>ℹ️</span>
          <span>
            Panel exclusivo para administradores. Puedes crear usuarios estándar,
            asignar módulos de acceso y gestionar su estado.
            Los usuarios <strong>ADMINISTRADOR</strong> no se editan desde aquí.
          </span>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-card" style={{ borderLeft: "3px solid var(--brand)" }}>
            <p className="stat-label">Total usuarios</p>
            <p className="stat-value">{usuarios.length}</p>
          </div>
          <div className="stat-card" style={{ borderLeft: "3px solid var(--success)" }}>
            <p className="stat-label">Activos</p>
            <p className="stat-value" style={{ color: "var(--success)" }}>{activos}</p>
          </div>
          <div className="stat-card" style={{ borderLeft: "3px solid var(--danger)" }}>
            <p className="stat-label">Inactivos</p>
            <p className="stat-value" style={{ color: "var(--danger)" }}>{inactivos}</p>
          </div>
        </div>

        {/* Tabla */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Usuarios estándar</span>
            <span className="text-sm text-muted">{usuariosFiltrados.length} registros</span>
          </div>

          {/* Filtros */}
          <div style={{
            padding: "0.75rem 1.5rem", borderBottom: "1px solid var(--border)",
            display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap",
          }}>
            <input
              className="form-input" type="search"
              placeholder="Buscar por nombre o usuario..."
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              style={{ maxWidth: "280px", flex: "1 1 200px" }}
            />
            {(["TODOS", "ACTIVO", "INACTIVO"] as const).map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                style={{
                  padding: "5px 14px", borderRadius: "99px", fontSize: "0.8rem",
                  border: "1px solid",
                  borderColor: filtroEstado === e ? "var(--brand)" : "var(--border)",
                  background:  filtroEstado === e ? "var(--brand)" : "transparent",
                  color:       filtroEstado === e ? "#fff" : "var(--text-2)",
                  cursor: "pointer", fontWeight: filtroEstado === e ? 600 : 400,
                  transition: "all 0.15s",
                }}
              >
                {e === "TODOS" ? "Todos" : e === "ACTIVO" ? "Activos" : "Inactivos"}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ padding: "1rem 1.5rem" }}>
              <div className="alert alert-danger">{error}</div>
            </div>
          )}

          {loading && (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.875rem" }}>
              Cargando usuarios...
            </div>
          )}

          {!loading && usuarios.length === 0 && (
            <div className="empty-state">
              <p>No hay usuarios estándar registrados.</p>
              <button className="btn btn-primary" style={{ marginTop: "1rem" }}
                onClick={() => { setEditando(null); setModal("nuevo"); }}>
                + Crear primer usuario
              </button>
            </div>
          )}

          {!loading && usuarios.length > 0 && usuariosFiltrados.length === 0 && (
            <div className="empty-state">
              <p>No hay usuarios que coincidan con el filtro.</p>
              <button className="btn btn-ghost" style={{ marginTop: "0.75rem" }}
                onClick={() => { setBusqueda(""); setFiltroEstado("TODOS"); }}>
                Limpiar filtros
              </button>
            </div>
          )}

          {!loading && usuariosFiltrados.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Estado</th>
                    <th>Módulos con acceso</th>
                    <th>Creado</th>
                    <th>Actualizado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((u) => (
                    <tr key={u.id} style={u.estado === "INACTIVO" ? { opacity: 0.6 } : {}}>

                      {/* Usuario */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div className="avatar"
                            style={{ width: "32px", height: "32px", fontSize: "0.72rem" }}>
                            {u.nombre.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{u.nombre}</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>
                              @{u.username} · ESTÁNDAR
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Estado */}
                      <td>
                        {u.estado === "ACTIVO"
                          ? <span className="badge badge-success">Activo</span>
                          : <span className="badge badge-danger">Inactivo</span>}
                      </td>

                      {/* Módulos */}
                      <td>
                        {u.permisos.length === 0 ? (
                          <span style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>Sin acceso</span>
                        ) : (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            {u.permisos.map((m) => (
                              <span key={m} style={{
                                background: "var(--brand-light)", color: "var(--brand)",
                                border: "1px solid #c3d7fc", borderRadius: "99px",
                                padding: "1px 8px", fontSize: "0.72rem", fontWeight: 500,
                                display: "flex", alignItems: "center", gap: "3px",
                              }}>
                                {MODULOS_INFO[m]?.icon} {MODULOS_INFO[m]?.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Fechas */}
                      <td className="text-muted" style={{ fontSize: "0.8rem" }}>
                        {fmtFecha(u.fecha_crea)}
                      </td>
                      <td className="text-muted" style={{ fontSize: "0.8rem" }}>
                        {fmtFecha(u.fecha_act)}
                      </td>

                      {/* Acciones */}
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setEditando(u); setModal("editar"); }}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: u.estado === "ACTIVO" ? "var(--danger)" : "var(--success)" }}
                            onClick={() => setConfirmId(u.id)}
                          >
                            {u.estado === "ACTIVO" ? "🚫 Desactivar" : "✅ Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Nuevo usuario */}
      {modal === "nuevo" && (
        <Modal titulo="Nuevo usuario estándar" onClose={() => setModal(null)}>
          <FormUsuario
            headers={headers}
            onGuardar={() => { setModal(null); cargar(); }}
            onCancelar={() => setModal(null)}
          />
        </Modal>
      )}

      {/* Modal: Editar usuario */}
      {modal === "editar" && editando && (
        <Modal
          titulo={`Editar: ${editando.nombre}`}
          onClose={() => { setModal(null); setEditando(null); }}
        >
          <FormUsuario
            inicial={editando}
            headers={headers}
            onGuardar={() => { setModal(null); setEditando(null); cargar(); }}
            onCancelar={() => { setModal(null); setEditando(null); }}
          />
        </Modal>
      )}

      {/* Modal: Confirmar cambio de estado */}
      {confirmId && usuarioAConfirmar && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setConfirmId(null)}>
          <div className="modal" style={{ maxWidth: "400px" }}>
            <div className="modal-header">
              <span className="modal-title">
                {usuarioAConfirmar.estado === "ACTIVO" ? "Desactivar usuario" : "Activar usuario"}
              </span>
              <button className="btn btn-ghost btn-icon" onClick={() => setConfirmId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: "0.5rem" }}>
                ¿Confirmas que deseas{" "}
                <strong>
                  {usuarioAConfirmar.estado === "ACTIVO" ? "desactivar" : "activar"}
                </strong>{" "}
                al usuario <strong>{usuarioAConfirmar.nombre}</strong>{" "}
                <span style={{ color: "var(--text-3)" }}>(@{usuarioAConfirmar.username})</span>?
              </p>
              {usuarioAConfirmar.estado === "ACTIVO" && (
                <p style={{ fontSize: "0.82rem", color: "var(--text-3)" }}>
                  El usuario no podrá iniciar sesión mientras esté inactivo.
                  Puedes reactivarlo en cualquier momento.
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmId(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                style={
                  usuarioAConfirmar.estado === "ACTIVO"
                    ? { background: "var(--danger)", borderColor: "var(--danger)" }
                    : {}
                }
                onClick={() => toggleEstado(usuarioAConfirmar)}
              >
                {usuarioAConfirmar.estado === "ACTIVO" ? "Sí, desactivar" : "Sí, activar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}