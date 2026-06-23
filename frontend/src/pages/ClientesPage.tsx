import { useState, useMemo } from "react";
import { useClientes } from "../hooks/useClientes";
import type { CrearClienteDTO, ActualizarClienteDTO, Cliente, TipoDocumento } from "../types";
import { IconPlus, IconEdit, IconTrash, IconX } from "../components/Icons";

const SCORE_MIN = 300;
const SCORE_MAX = 850;

function scoreColor(score: number) {
  if (score >= 700) return "badge-success";
  if (score >= 600) return "badge-warning";
  return "badge-danger";
}

function scoreLabel(score: number) {
  if (score >= 700) return "Excelente";
  if (score >= 600) return "Bueno";
  return "Bajo";
}

function ScoreBar({ score }: { score: number }) {
  const pct   = ((score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100;
  const color = score >= 700 ? "var(--success)" : score >= 600 ? "var(--warning)" : "var(--danger)";
  return (
    <div className="score-bar">
      <div className="score-track">
        <div className="score-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm font-medium">{score}</span>
    </div>
  );
}

interface FormState {
  nombres:             string;
  apellidos:           string;
  documento_identidad: string;
  tipo_documento:      string;
  email:               string;
  score:               number;
  telefono:            string;
}

const EMPTY: FormState = {
  nombres: "", apellidos: "", documento_identidad: "",
  tipo_documento: "CEDULA", email: "", score: 650, telefono: "",
};

export function ClientesPage() {
  const { clientes, loading, error, crear, actualizar, eliminar } = useClientes();

  const [showModal, setShowModal] = useState(false);
  const [editando,  setEditando]  = useState<Cliente | null>(null);
  const [form,      setForm]      = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [busqueda,  setBusqueda]  = useState("");

  const clientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      c.nombres.toLowerCase().includes(q)             ||
      c.apellidos.toLowerCase().includes(q)           ||
      c.documento_identidad.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)              ||
      c.telefono_principal?.toLowerCase().includes(q)
    );
  }, [clientes, busqueda]);

  const openCrear = () => {
    setEditando(null);
    setForm(EMPTY);
    setFormError(null);
    setShowModal(true);
  };

  const openEditar = (c: Cliente) => {
    setEditando(c);
    setForm({
      nombres:             c.nombres,
      apellidos:           c.apellidos,
      documento_identidad: c.documento_identidad,
      tipo_documento:      c.tipo_documento ?? "CEDULA",
      email:               c.email ?? "",
      score:               c.score ?? 650,
      telefono:            c.telefono_principal ?? "",
    });
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === "score" ? Number(value) : value }));
    if (formError) setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      if (editando) {
        const datos: ActualizarClienteDTO = {
          nombres:   form.nombres   || undefined,
          apellidos: form.apellidos || undefined,
          email:     form.email     || undefined,
          score:     form.score     || undefined,
          telefono:  form.telefono  || undefined,
        };
        await actualizar(editando.id, datos);
      } else {
        const datos: CrearClienteDTO = {
          nombres:             form.nombres,
          apellidos:           form.apellidos,
          documento_identidad: form.documento_identidad,
          tipo_documento:      form.tipo_documento as TipoDocumento,
          email:               form.email    || undefined,
          score:               form.score    || undefined,
          telefono:            form.telefono || undefined,
        };
        await crear(datos);
      }
      closeModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      setFormError(msg.includes("duplicate") || msg.includes("unique")
        ? "Ya existe un cliente con ese documento de identidad."
        : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm("¿Inactivar este cliente?")) return;
    try { await eliminar(id); } catch {/* silencioso */}
  };

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Clientes</span>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={openCrear}>
            <IconPlus size={15} /> Nuevo cliente
          </button>
        </div>
      </div>

      <div className="page">
        <div className="stats-grid">
          <div className="stat-card">
            <p className="stat-label">Total clientes</p>
            <p className="stat-value">{clientes.length}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Score promedio</p>
            <p className="stat-value">
              {clientes.length
                ? Math.round(clientes.reduce((a, c) => a + (c.score ?? 0), 0) / clientes.length)
                : "—"}
            </p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Aptos (≥600)</p>
            <p className="stat-value" style={{ color: "var(--success)" }}>
              {clientes.filter((c) => (c.score ?? 0) >= 600).length}
            </p>
          </div>
          <div className="stat-card">
            <p className="stat-label">No aptos (&lt;600)</p>
            <p className="stat-value" style={{ color: "var(--danger)" }}>
              {clientes.filter((c) => (c.score ?? 0) < 600).length}
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Listado de clientes</span>
            <span className="text-sm text-muted">{clientesFiltrados.length} registros</span>
          </div>

          <div style={{ padding: "0.75rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
            <input
              className="form-input" type="search"
              placeholder="Buscar por nombre, documento, email o teléfono..."
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              style={{ maxWidth: "420px" }}
            />
          </div>

          {loading && (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.875rem" }}>
              Cargando clientes...
            </div>
          )}
          {error && (
            <div style={{ padding: "1rem 1.5rem" }}>
              <div className="alert alert-danger">{error}</div>
            </div>
          )}
          {!loading && clientes.length === 0 && (
            <div className="empty-state">
              <p>No hay clientes registrados aún.</p>
              <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={openCrear}>
                <IconPlus size={15} /> Agregar primer cliente
              </button>
            </div>
          )}
          {!loading && clientes.length > 0 && clientesFiltrados.length === 0 && (
            <div className="empty-state">
              <p>No se encontraron clientes para "<strong>{busqueda}</strong>".</p>
              <button className="btn btn-ghost" style={{ marginTop: "0.75rem" }} onClick={() => setBusqueda("")}>
                Limpiar búsqueda
              </button>
            </div>
          )}

          {!loading && clientesFiltrados.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Documento</th>
                    <th>Teléfono</th>
                    <th>Email</th>
                    <th>Score crediticio</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div className="avatar" style={{ width: "30px", height: "30px", fontSize: "0.7rem" }}>
                            {c.nombres.slice(0,1)}{c.apellidos.slice(0,1)}
                          </div>
                          <div>
                            <div className="font-medium">{c.nombres} {c.apellidos}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-muted" style={{ fontSize: "0.82rem" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{c.tipo_documento}</div>
                        <div>{c.documento_identidad}</div>
                      </td>
                      <td className="text-muted">{c.telefono_principal ?? "—"}</td>
                      <td className="text-muted" style={{ fontSize: "0.82rem" }}>{c.email ?? "—"}</td>
                      <td style={{ minWidth: "160px" }}>
                        {c.score != null
                          ? <ScoreBar score={c.score} />
                          : <span className="text-muted">—</span>}
                      </td>
                      <td>
                        {c.score != null
                          ? <span className={`badge ${scoreColor(c.score)}`}>{scoreLabel(c.score)}</span>
                          : <span className="badge badge-gray">Sin score</span>}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEditar(c)}
                            title="Editar" aria-label={`Editar ${c.nombres}`}>
                            <IconEdit />
                          </button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleEliminar(c.id)}
                            title="Inactivar" aria-label={`Inactivar ${c.nombres}`}>
                            <IconTrash />
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

      {showModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editando ? "Editar cliente" : "Nuevo cliente"}</span>
              <button className="btn btn-ghost btn-icon" onClick={closeModal} aria-label="Cerrar"><IconX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger">{formError}</div>}

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Nombres</label>
                    <input className="form-input" name="nombres" placeholder="Ej. María Elena"
                      value={form.nombres} onChange={handleChange} required={!editando} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Apellidos</label>
                    <input className="form-input" name="apellidos" placeholder="Ej. García Pérez"
                      value={form.apellidos} onChange={handleChange} required={!editando} />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Documento de identidad</label>
                    <input className="form-input" name="documento_identidad"
                      placeholder="000-0000000-0"
                      value={form.documento_identidad} onChange={handleChange}
                      required={!editando} disabled={!!editando} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tipo documento</label>
                    <select className="form-select" name="tipo_documento"
                      value={form.tipo_documento} onChange={handleChange}
                      disabled={!!editando} aria-label="Tipo de documento">
                      <option value="CEDULA">Cédula</option>
                      <option value="PASAPORTE">Pasaporte</option>
                      <option value="LICENCIA">Licencia</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Teléfono</label>
                    <input className="form-input" name="telefono" type="tel"
                      placeholder="809-000-0000"
                      value={form.telefono} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Email <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span>
                    </label>
                    <input className="form-input" name="email" type="email"
                      placeholder="maria@ejemplo.com"
                      value={form.email} onChange={handleChange} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="score">
                    Score crediticio — <span style={{ color: "var(--brand)", fontWeight: 600 }}>{form.score}</span>
                  </label>
                  <input id="score" type="range" name="score"
                    min={SCORE_MIN} max={SCORE_MAX} step={1}
                    value={form.score} onChange={handleChange}
                    style={{ width: "100%", accentColor: "var(--brand)" }} />
                  <div style={{ display: "flex", justifyContent: "space-between",
                    fontSize: "0.72rem", color: "var(--text-3)", marginTop: "2px" }}>
                    <span>{SCORE_MIN} — Bajo</span>
                    <span>600 — Límite</span>
                    <span>{SCORE_MAX} — Excelente</span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Guardando..." : editando ? "Guardar cambios" : "Crear cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}