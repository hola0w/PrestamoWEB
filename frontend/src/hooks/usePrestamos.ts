import { useState, useEffect, useCallback } from "react";
import type { Prestamo, CrearPrestamoDTO, EstadoPrestamo, Cobro } from "../types";
import { prestamosService } from "../services/prestamosService";
import { cobrosService }    from "../services/cobrosService";

export function usePrestamos() {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await prestamosService.listar();
      setPrestamos(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar préstamos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = useCallback(async (datos: CrearPrestamoDTO) => {
    const nuevo = await prestamosService.crear(datos);
    setPrestamos((prev) => [nuevo, ...prev]);
    return nuevo;
  }, []);

  const cambiarEstado = useCallback(async (id: string, estado: EstadoPrestamo) => {
    const actualizado = await prestamosService.cambiarEstado(id, estado);
    setPrestamos((prev) => prev.map((p) => (p.id === id ? actualizado : p)));
    return actualizado;
  }, []);

  const registrarCobro = useCallback(
    async (prestamoId: string, montoPagado: number): Promise<Cobro> => {
      const cobro = await cobrosService.registrar({ prestamoId, montoPagado });
      await cargar();
      return cobro;
    },
    [cargar]
  );

  return { prestamos, loading, error, cargar, crear, cambiarEstado, registrarCobro };
}