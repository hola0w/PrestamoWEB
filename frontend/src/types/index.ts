export type EstadoPrestamo = "PENDIENTE" | "APROBADO" | "ACTIVO" | "PAGADO" | "MOROSO" | "CANCELADO";
export type EstadoCliente  = "ACTIVO" | "INACTIVO" | "MOROSO";
export type TipoPlazo      = "DIARIO" | "SEMANAL" | "QUINCENAL" | "MENSUAL";
export type TipoDocumento  = "CEDULA" | "PASAPORTE" | "LICENCIA";
export type EstadoSucursal = "ACTIVA" | "INACTIVA";

export interface Cliente {
  id:                   string;
  nombres:              string;
  apellidos:            string;
  documento_identidad:  string;
  tipo_documento:       TipoDocumento;
  email?:               string | null;
  score?:               number | null;
  estado:               EstadoCliente;
  created_at:           string;
  updated_at?:          string | null;
  nombre:               string;
  telefono_principal?:  string | null;
}

export interface CrearClienteDTO {
  nombres:             string;
  apellidos:           string;
  documento_identidad: string;
  tipo_documento?:     TipoDocumento;
  email?:              string;
  score?:              number;
  telefono?:           string;
}

export interface ActualizarClienteDTO {
  nombres?:   string;
  apellidos?: string;
  email?:     string;
  score?:     number;
  telefono?:  string;
}

export interface Prestamo {
  id:               string;
  cliente_id:       string;
  cliente_nombre:   string;
  capital:          number;
  tasa_anual:       number;
  plazo_meses:      number;
  cuota_mensual:    number;
  tipo_plazo:       TipoPlazo;
  estado:           EstadoPrestamo;
  fecha_inicio:     string;
  fecha_fin?:       string | null;
  balance_pendiente?: number | null;
  observacion?:     string | null;
  codigo:           string;
  total_pagado:     number;
  monto_restante:   number;
}

export interface CrearPrestamoDTO {
  clienteId:    string;
  capital:      number;
  tasaAnual:    number;
  plazoMeses:   number;
  tipoPlazo:    TipoPlazo;
  observacion?: string;
}

export interface Cobro {
  id:           string;
  prestamo_id:  string;
  monto_pagado: number;
  estado_cobro: "PENDIENTE" | "PAGADO" | "PARCIAL" | "ATRASADO";
  created_at:   string;
  updated_at:   string | null;
  capital?:         number;
  cuota_mensual?:   number;
  cliente_nombre?:  string;
}

export interface ResumenCobro {
  capital:           number;
  cuota_mensual:     number;
  plazo_meses:       number;
  total_a_pagar:     number;
  total_pagado:      number;
  saldo_pendiente:   number;
  cobros_pagados:    number;
  cobros_parciales:  number;
  cobros_pendientes: number;
}

export interface Sucursal {
  id:          string;
  empresa_id:  string;
  nombre:      string;
  direccion:   string;
  telefono:    string | null;
  estado:      EstadoSucursal;
  created_at:  string;
  updated_at:  string | null;
}

export interface CrearSucursalDTO {
  nombre:      string;
  direccion:   string;
  telefono?:   string | null;
  estado?:     EstadoSucursal;
  empresa_id:  string;
}

export interface ActualizarSucursalDTO {
  nombre?:     string;
  direccion?:  string;
  telefono?:   string | null;
  estado?:     EstadoSucursal;
}