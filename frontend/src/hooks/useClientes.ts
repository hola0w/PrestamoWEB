import { useState, useEffect, useCallback } from "react";
import type { Cliente, CrearClienteDTO, ActualizarClienteDTO } from "../types";
import { clientesService } from "../services/clientesService";

export function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await clientesService.listar();
      setClientes(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = useCallback(async (datos: CrearClienteDTO) => {
    const nuevo = await clientesService.crear(datos);
    setClientes((prev) => [...prev, nuevo]);
    return nuevo;
  }, []);

  const actualizar = useCallback(async (id: string, datos: ActualizarClienteDTO) => {
    const actualizado = await clientesService.actualizar(id, datos);
    setClientes((prev) => prev.map((c) => (c.id === id ? actualizado : c)));
    return actualizado;
  }, []);

  const eliminar = useCallback(async (id: string) => {
    await clientesService.eliminar(id);
    setClientes((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { clientes, loading, error, cargar, crear, actualizar, eliminar };
}