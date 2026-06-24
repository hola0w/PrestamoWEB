import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { sucursalesService } from "../services/SucursalService";
import type { Sucursal } from "../types";

// ── Helpers ───────────────────────────────────────────────────
function fmtFecha(f: string | null) {
  if (!f) return "—";
  return new Date(f).toLocaleDateString("es-DO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Formulario crear / editar ─────────────────────────────────
interface FormProps {
  inicial?:   Sucursal | null;
  onGuardar:  () => void;
  onCancelar: () => void;
}

function FormSucursal({ inicial, onGuardar, onCancelar }: FormProps) {
  const esNuevo = !inicial;
  const { usuario } = useAuth();

  const [nombre,    setNombre]    = useState(inicial?.nombre    ?? "");
  const [direccion, setDireccion] = useState(inicial?.direccion ?? "");
  const [telefono,  setTelefono]  = useState(inicial?.telefono  ?? "");
  const [estado,    setEstado]    = useState<"ACTIVA" | "INACTIVA">(inicial?.estado ?? "ACTIVA");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim())    { setError("El nombre de la sucursal es obligatorio."); return; }
    if (!direccion.trim()) { setError("La dirección es obligatoria."); return; }

    const empresaId = usuario?.empresaId ?? undefined;
    if (esNuevo && !empresaId) {
      setError("No se pudo determinar la empresa asociada a tu usuario.");
      return;
    }

    setSaving(true);
    try {
      if (esNuevo) {
        await sucursalesService.crear({
          nombre:     nombre.trim(),
          direccion:  direccion.trim(),
          telefono:   telefono.trim() || null,
          estado,
          empresa_id: empresaId!,
        });
      } else {
        await sucursalesService.actualizar(inicial!.id, {
          nombre:    nombre.trim(),
          direccion: direccion.trim(),
          telefono:  telefono.trim() || null,
          estado,
        });
      }
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

        {/* Nombre */}
        <div className="form-group">
          <label className="form-label" htmlFor="s-nombre">Nombre de la sucursal</label>
          <input
            id="s-nombre" className="form-input" type="text"
            value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="ej. Sucursal Santiago" required autoFocus
          />
        </div>

        {/* Dirección */}
        <div className="form-group">
          <label className="form-label" htmlFor="s-direccion">Dirección</label>
          <input
            id="s-direccion" className="form-input" type="text"
            value={direccion} onChange={(e) => setDireccion(e.target.value)}
            placeholder="ej. Calle Principal #12, Santiago" required
          />
        </div>

        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {/* Teléfono */}
          <div className="form-group">
            <label className="form-label" htmlFor="s-telefono">Teléfono (opcional)</label>
            <input
              id="s-telefono" className="form-input" type="text"
              value={telefono} onChange={(e) => setTelefono(e.target.value)}
              placeholder="ej. 809-555-0000"
            />
          </div>

          {/* Estado (solo en edición) */}
          {!esNuevo && (
            <div className="form-group">
              <label className="form-label" htmlFor="s-estado">Estado</label>
              <select
                id="s-estado"
                className="form-select"
                value={estado}
                onChange={(e) => setEstado(e.target.value as "ACTIVA" | "INACTIVA")}
              >
                <option value="ACTIVA">Activa</option>
                <option value="INACTIVA">Inactiva</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onCancelar} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Guardando..." : esNuevo ? "Registrar sucursal" : "Guardar cambios"}
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
      <div className="modal" style={{ maxWidth: "520px" }}>
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
export function SucursalPage() {
  const { usuario } = useAuth();

  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [modal,      setModal]      = useState<"nuevo" | "editar" | null>(null);
  const [editando,   setEditando]   = useState<Sucursal | null>(null);
  const [busqueda,   setBusqueda]   = useState("");

  // ── Cargar sucursales ───────────────────────────────────────
  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sucursalesService.listar();
      setSucursales(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  // ── Filtrado ────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return sucursales.filter((s) =>
      !q || s.nombre.toLowerCase().includes(q) || s.direccion.toLowerCase().includes(q)
    );
  }, [sucursales, busqueda]);

  // ── Stats ───────────────────────────────────────────────────
  const activas = sucursales.filter((s) => s.estado === "ACTIVA").length;

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <span className="topbar-title">Sucursales</span>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={cargar} disabled={loading}>
            {loading ? "Actualizando..." : "↻ Actualizar"}
          </button>
          <button className="btn btn-primary" onClick={() => { setEditando(null); setModal("nuevo"); }}>
            + Nueva sucursal
          </button>
        </div>
      </div>

      <div className="page">
        {/* Aviso de empresa */}
        {usuario?.empresaNombre && (
          <div style={{
            background: "var(--brand-light)", border: "1px solid #c3d7fc",
            borderRadius: "var(--radius-md)", padding: "0.75rem 1rem",
            fontSize: "0.82rem", color: "var(--brand)",
            marginBottom: "1.5rem", display: "flex", gap: "8px",
          }}>
            <span>ℹ️</span>
            <span>
              Gestionando sucursales de <strong>{usuario.empresaNombre}</strong>.
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-card" style={{ borderLeft: "3px solid var(--brand)" }}>
            <p className="stat-label">Total sucursales</p>
            <p className="stat-value">{sucursales.length}</p>
          </div>
          <div className="stat-card" style={{ borderLeft: "3px solid var(--success)" }}>
            <p className="stat-label">Activas</p>
            <p className="stat-value" style={{ color: "var(--success)" }}>{activas}</p>
          </div>
          <div className="stat-card" style={{ borderLeft: "3px solid var(--danger)" }}>
            <p className="stat-label">Inactivas</p>
            <p className="stat-value" style={{ color: "var(--danger)" }}>{sucursales.length - activas}</p>
          </div>
        </div>

        {/* Tabla */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Listado de sucursales</span>
            <span className="text-sm text-muted">{filtradas.length} registros</span>
          </div>

          {/* Filtro búsqueda */}
          <div style={{
            padding: "0.75rem 1.5rem", borderBottom: "1px solid var(--border)",
            display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap",
          }}>
            <input
              className="form-input" type="search"
              placeholder="Buscar por nombre o dirección..."
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              style={{ maxWidth: "320px", flex: "1 1 200px" }}
            />
          </div>

          {error && (
            <div style={{ padding: "1rem 1.5rem" }}>
              <div className="alert alert-danger">{error}</div>
            </div>
          )}

          {loading && (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.875rem" }}>
              Cargando sucursales...
            </div>
          )}

          {!loading && sucursales.length === 0 && (
            <div className="empty-state">
              <p>No hay sucursales registradas.</p>
              <button className="btn btn-primary" style={{ marginTop: "1rem" }}
                onClick={() => { setEditando(null); setModal("nuevo"); }}>
                + Registrar primera sucursal
              </button>
            </div>
          )}

          {!loading && sucursales.length > 0 && filtradas.length === 0 && (
            <div className="empty-state">
              <p>No hay sucursales que coincidan con la búsqueda.</p>
              <button className="btn btn-ghost" style={{ marginTop: "0.75rem" }}
                onClick={() => setBusqueda("")}>
                Limpiar búsqueda
              </button>
            </div>
          )}

          {!loading && filtradas.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Sucursal</th>
                    <th>Dirección</th>
                    <th>Teléfono</th>
                    <th>Estado</th>
                    <th>Creada</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((s) => (
                    <tr key={s.id} style={s.estado === "INACTIVA" ? { opacity: 0.6 } : {}}>
                      <td className="font-medium">{s.nombre}</td>
                      <td className="text-muted">{s.direccion}</td>
                      <td className="text-muted">{s.telefono ?? "—"}</td>
                      <td>
                        {s.estado === "ACTIVA"
                          ? <span className="badge badge-success">Activa</span>
                          : <span className="badge badge-danger">Inactiva</span>}
                      </td>
                      <td className="text-muted" style={{ fontSize: "0.8rem" }}>
                        {fmtFecha(s.created_at)}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => { setEditando(s); setModal("editar"); }}
                        >
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Nueva sucursal */}
      {modal === "nuevo" && (
        <Modal titulo="Registrar nueva sucursal" onClose={() => setModal(null)}>
          <FormSucursal
            onGuardar={() => { setModal(null); cargar(); }}
            onCancelar={() => setModal(null)}
          />
        </Modal>
      )}

      {/* Modal: Editar sucursal */}
      {modal === "editar" && editando && (
        <Modal
          titulo={`Editar: ${editando.nombre}`}
          onClose={() => { setModal(null); setEditando(null); }}
        >
          <FormSucursal
            inicial={editando}
            onGuardar={() => { setModal(null); setEditando(null); cargar(); }}
            onCancelar={() => { setModal(null); setEditando(null); }}
          />
        </Modal>
      )}
    </>
  );
}