
-- ══════════════════════════════════════════════════════════════
-- RESET COMPLETO
-- ══════════════════════════════════════════════════════════════

TRUNCATE TABLE pagos                    RESTART IDENTITY CASCADE;
TRUNCATE TABLE cuotas_prestamo          RESTART IDENTITY CASCADE;
TRUNCATE TABLE cobros_prestamos         RESTART IDENTITY CASCADE;
TRUNCATE TABLE prestamos                RESTART IDENTITY CASCADE;
TRUNCATE TABLE telefonos_clientes       RESTART IDENTITY CASCADE;
TRUNCATE TABLE direcciones_clientes     RESTART IDENTITY CASCADE;
TRUNCATE TABLE clientes                 RESTART IDENTITY CASCADE;
TRUNCATE TABLE usuarios                 RESTART IDENTITY CASCADE;

DROP TABLE IF EXISTS pagos;
DROP TABLE IF EXISTS cuotas_prestamo;
DROP TABLE IF EXISTS cobros_prestamos;
DROP TABLE IF EXISTS prestamos;
DROP TABLE IF EXISTS telefonos_clientes;
DROP TABLE IF EXISTS direcciones_clientes;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS usuarios;

DROP TYPE IF EXISTS estado_pago;
DROP TYPE IF EXISTS estado_cuota;
DROP TYPE IF EXISTS tipo_plazo;
DROP TYPE IF EXISTS estado_prestamo;
DROP TYPE IF EXISTS estado_cliente;
DROP TYPE IF EXISTS estado_usuario;
DROP TYPE IF EXISTS tipo_documento_identidad;

-- ══════════════════════════════════════════════════════════════
-- EXTENSIONES
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ══════════════════════════════════════════════════════════════
-- ENUMS
-- ══════════════════════════════════════════════════════════════

CREATE TYPE estado_usuario AS ENUM (
  'ACTIVO',
  'INACTIVO',
  'BLOQUEADO'
);

CREATE TYPE estado_cliente AS ENUM (
  'ACTIVO',
  'INACTIVO',
  'MOROSO'
);

CREATE TYPE estado_prestamo AS ENUM (
  'PENDIENTE',
  'APROBADO',
  'ACTIVO',
  'PAGADO',
  'MOROSO',
  'CANCELADO'
);

CREATE TYPE estado_pago AS ENUM (
  'PENDIENTE',
  'PAGADO',
  'PARCIAL',
  'ATRASADO'
);

CREATE TYPE estado_cuota AS ENUM (
  'PENDIENTE',
  'PAGADO',
  'VENCIDO',
  'PARCIAL'
);

CREATE TYPE tipo_plazo AS ENUM (
  'DIARIO',
  'SEMANAL',
  'QUINCENAL',
  'MENSUAL'
);

CREATE TYPE tipo_documento_identidad AS ENUM (
  'CEDULA',
  'PASAPORTE',
  'LICENCIA'
);

-- ══════════════════════════════════════════════════════════════
-- TABLA USUARIOS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE usuarios (

  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  nombre          VARCHAR(100) NOT NULL,

  username        VARCHAR(100) UNIQUE NOT NULL,

  email           VARCHAR(150) UNIQUE,

  password        VARCHAR(255) NOT NULL,

  estado          estado_usuario DEFAULT 'ACTIVO',

  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  updated_at      TIMESTAMP
);

-- ══════════════════════════════════════════════════════════════
-- TABLA CLIENTES
-- ══════════════════════════════════════════════════════════════

CREATE TABLE clientes (

  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  nombres                   VARCHAR(100) NOT NULL,

  apellidos                 VARCHAR(100) NOT NULL,

  documento_identidad       VARCHAR(20) UNIQUE NOT NULL,

  tipo_documento            tipo_documento_identidad DEFAULT 'CEDULA',

  foto_documento_frontal    TEXT NOT NULL,

  foto_documento_trasera    TEXT,

  selfie_cliente            TEXT,

  fecha_nacimiento          DATE,

  sexo                      VARCHAR(20),

  email                     VARCHAR(150) UNIQUE,

  ocupacion                 VARCHAR(100),

  empresa                   VARCHAR(100),

  ingresos_mensuales        NUMERIC(12,2),

  score                     INTEGER CHECK (score BETWEEN 300 AND 850),

  estado                    estado_cliente DEFAULT 'ACTIVO',

  observacion               TEXT,

  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  updated_at                TIMESTAMP
);

-- ══════════════════════════════════════════════════════════════
-- TELEFONOS CLIENTES
-- ══════════════════════════════════════════════════════════════

CREATE TABLE telefonos_clientes (

  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  cliente_id      UUID NOT NULL
                   REFERENCES clientes(id)
                   ON DELETE CASCADE,

  telefono        VARCHAR(20) NOT NULL,

  tipo            VARCHAR(20),

  principal       BOOLEAN DEFAULT FALSE
);

-- ══════════════════════════════════════════════════════════════
-- DIRECCIONES CLIENTES
-- ══════════════════════════════════════════════════════════════

CREATE TABLE direcciones_clientes (

  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  cliente_id      UUID NOT NULL
                   REFERENCES clientes(id)
                   ON DELETE CASCADE,

  direccion       TEXT NOT NULL,

  ciudad          VARCHAR(100),

  provincia       VARCHAR(100),

  referencia      TEXT,

  principal       BOOLEAN DEFAULT FALSE
);

-- ══════════════════════════════════════════════════════════════
-- TABLA PRESTAMOS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE prestamos (

  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  cliente_id            UUID NOT NULL
                         REFERENCES clientes(id)
                         ON DELETE CASCADE,

  usuario_registra_id   UUID
                         REFERENCES usuarios(id),

  usuario_aprueba_id    UUID
                         REFERENCES usuarios(id),

  capital               NUMERIC(12,2) NOT NULL
                         CHECK(capital > 0),

  interes_total         NUMERIC(12,2) DEFAULT 0,

  balance_pendiente     NUMERIC(12,2),

  tasa_anual            NUMERIC(5,2) NOT NULL
                         CHECK(tasa_anual >= 0),

  mora_porcentaje       NUMERIC(5,2) DEFAULT 0,

  plazo_meses           INTEGER NOT NULL
                         CHECK(plazo_meses > 0),

  cuota_mensual         NUMERIC(12,2) NOT NULL
                         CHECK(cuota_mensual > 0),

  tipo_plazo            tipo_plazo NOT NULL DEFAULT 'MENSUAL',

  garantia              TEXT,

  observacion           TEXT,

  estado                estado_prestamo DEFAULT 'PENDIENTE',

  fecha_solicitud       DATE DEFAULT CURRENT_DATE,

  fecha_aprobacion      DATE,

  fecha_inicio          DATE DEFAULT CURRENT_DATE,

  fecha_fin             DATE,

  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  updated_at            TIMESTAMP
);

-- ══════════════════════════════════════════════════════════════
-- TABLA CUOTAS PRESTAMO
-- ══════════════════════════════════════════════════════════════

CREATE TABLE cuotas_prestamo (

  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  prestamo_id           UUID NOT NULL
                         REFERENCES prestamos(id)
                         ON DELETE CASCADE,

  numero_cuota          INTEGER NOT NULL
                         CHECK(numero_cuota > 0),

  fecha_vence           DATE NOT NULL,

  fecha_pago            DATE,

  monto_cuota           NUMERIC(12,2) NOT NULL
                         CHECK(monto_cuota > 0),

  capital_pagado        NUMERIC(12,2) DEFAULT 0,

  interes_pagado        NUMERIC(12,2) DEFAULT 0,

  mora_pagada           NUMERIC(12,2) DEFAULT 0,

  balance_restante      NUMERIC(12,2),

  dias_atraso           INTEGER DEFAULT 0,

  estado                estado_cuota DEFAULT 'PENDIENTE',

  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  updated_at            TIMESTAMP,

  UNIQUE(prestamo_id, numero_cuota)
);

-- ══════════════════════════════════════════════════════════════
-- TABLA PAGOS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE pagos (

  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  prestamo_id           UUID NOT NULL
                         REFERENCES prestamos(id)
                         ON DELETE CASCADE,

  cuota_id              UUID
                         REFERENCES cuotas_prestamo(id)
                         ON DELETE SET NULL,

  usuario_id            UUID
                         REFERENCES usuarios(id),

  monto                 NUMERIC(12,2) NOT NULL
                         CHECK(monto > 0),

  capital               NUMERIC(12,2) DEFAULT 0,

  interes               NUMERIC(12,2) DEFAULT 0,

  mora                  NUMERIC(12,2) DEFAULT 0,

  metodo_pago           VARCHAR(50),

  referencia_pago       VARCHAR(100),

  comentario            TEXT,

  estado                estado_pago DEFAULT 'PENDIENTE',

  fecha_pago            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════════════════════════════
-- TABLA COBROS PRESTAMOS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE cobros_prestamos (

  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  prestamo_id           UUID NOT NULL
                         REFERENCES prestamos(id)
                         ON DELETE CASCADE,

  pago_id               UUID
                         REFERENCES pagos(id)
                         ON DELETE SET NULL,

  monto_pagado          NUMERIC(12,2) NOT NULL,

  estado_cobro          estado_pago DEFAULT 'PENDIENTE',

  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  updated_at            TIMESTAMP
);

-- ══════════════════════════════════════════════════════════════
-- INDICES
-- ══════════════════════════════════════════════════════════════

CREATE INDEX idx_clientes_documento
ON clientes(documento_identidad);

CREATE INDEX idx_prestamos_cliente
ON prestamos(cliente_id);

CREATE INDEX idx_cuotas_prestamo_id
ON cuotas_prestamo(prestamo_id);

CREATE INDEX idx_cuotas_fecha_vence
ON cuotas_prestamo(fecha_vence);

CREATE INDEX idx_cuotas_estado
ON cuotas_prestamo(estado);

CREATE INDEX idx_pagos_fecha
ON pagos(fecha_pago);

-- ══════════════════════════════════════════════════════════════
-- FUNCION UPDATED_AT
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$

BEGIN

  NEW.updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;

END;

$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════
-- TRIGGERS UPDATED_AT
-- ══════════════════════════════════════════════════════════════

CREATE TRIGGER trg_clientes_updated
BEFORE UPDATE ON clientes
FOR EACH ROW
EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_usuarios_updated
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_prestamos_updated
BEFORE UPDATE ON prestamos
FOR EACH ROW
EXECUTE FUNCTION actualizar_updated_at();

-- ══════════════════════════════════════════════════════════════
-- FUNCION GENERAR CUOTAS
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generar_cuotas_prestamo()
RETURNS TRIGGER AS $$

DECLARE

  v_fecha       DATE;
  v_intervalo   INTERVAL;
  v_num_cuotas  INTEGER;
  i             INTEGER;

BEGIN

  CASE NEW.tipo_plazo

    WHEN 'DIARIO' THEN
      v_intervalo := INTERVAL '1 day';
      v_num_cuotas := NEW.plazo_meses * 30;

    WHEN 'SEMANAL' THEN
      v_intervalo := INTERVAL '7 days';
      v_num_cuotas := NEW.plazo_meses * 4;

    WHEN 'QUINCENAL' THEN
      v_intervalo := INTERVAL '15 days';
      v_num_cuotas := NEW.plazo_meses * 2;

    ELSE
      v_intervalo := INTERVAL '1 month';
      v_num_cuotas := NEW.plazo_meses;

  END CASE;

  v_fecha := NEW.fecha_inicio + v_intervalo;

  FOR i IN 1..v_num_cuotas LOOP

    INSERT INTO cuotas_prestamo (

      prestamo_id,
      numero_cuota,
      fecha_vence,
      monto_cuota,
      balance_restante

    )

    VALUES (

      NEW.id,
      i,
      v_fecha,
      NEW.cuota_mensual,
      NEW.balance_pendiente

    );

    v_fecha := v_fecha + v_intervalo;

  END LOOP;

  RETURN NEW;

END;

$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════
-- TRIGGER GENERAR CUOTAS
-- ══════════════════════════════════════════════════════════════

CREATE TRIGGER trg_generar_cuotas

AFTER INSERT ON prestamos

FOR EACH ROW

EXECUTE FUNCTION generar_cuotas_prestamo();

-- ══════════════════════════════════════════════════════════════
-- FUNCION ACTUALIZAR CUOTAS VENCIDAS
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION actualizar_cuotas_vencidas()

RETURNS VOID AS $$

BEGIN

  UPDATE cuotas_prestamo

  SET

    estado = 'VENCIDO',
    updated_at = CURRENT_TIMESTAMP

  WHERE estado = 'PENDIENTE'
  AND fecha_vence < CURRENT_DATE;

END;

$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════
-- MEJORAS DE SEGURIDAD Y MULTIEMPRESA
-- SIN MODIFICAR TABLAS NI CAMPOS EXISTENTES
-- ══════════════════════════════════════════════════════════════

-- ============================================================
-- EMPRESAS
-- ============================================================

CREATE TABLE empresas (

id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

nombre          VARCHAR(150) NOT NULL UNIQUE,

estado          BOOLEAN DEFAULT TRUE,

created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

updated_at      TIMESTAMP
);

-- ============================================================
-- ROLES DE USUARIO
-- ============================================================

CREATE TYPE rol_usuario AS ENUM (

'ADMINISTRADOR',
'SUPERVISOR',
'COBRADOR',
'OPERADOR'

);

-- ============================================================
-- RELACION EMPRESA - USUARIO
-- ============================================================

ALTER TABLE usuarios

ADD COLUMN empresa_id UUID
REFERENCES empresas(id);

ALTER TABLE usuarios

ADD COLUMN rol rol_usuario
DEFAULT 'OPERADOR';

ALTER TABLE usuarios

ADD COLUMN intentos_fallidos INTEGER DEFAULT 0;

ALTER TABLE usuarios

ADD COLUMN ultimo_login TIMESTAMP;

-- ============================================================
-- RELACION EMPRESA - CLIENTE
-- ============================================================

ALTER TABLE clientes

ADD COLUMN empresa_id UUID
REFERENCES empresas(id);

ALTER TABLE clientes

ADD COLUMN zona_cobro VARCHAR(100);

-- ============================================================
-- RELACION EMPRESA - PRESTAMO
-- ============================================================

ALTER TABLE prestamos

ADD COLUMN empresa_id UUID
REFERENCES empresas(id);

ALTER TABLE prestamos

ADD COLUMN cobrador_id UUID
REFERENCES usuarios(id);

-- ============================================================
-- RELACION EMPRESA - PAGOS
-- ============================================================

ALTER TABLE pagos

ADD COLUMN empresa_id UUID
REFERENCES empresas(id);

-- ============================================================
-- RELACION EMPRESA - COBROS
-- ============================================================

ALTER TABLE cobros_prestamos

ADD COLUMN empresa_id UUID
REFERENCES empresas(id);

-- ============================================================
-- AUDITORIA
-- ============================================================

CREATE TABLE auditoria (

id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

usuario_id      UUID
REFERENCES usuarios(id),

tabla           VARCHAR(100) NOT NULL,

accion          VARCHAR(50) NOT NULL,

registro_id     UUID,

detalle         JSONB,

created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- GESTIONES DE COBRO
-- ============================================================

CREATE TABLE gestiones_cobro (

id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

prestamo_id     UUID NOT NULL
REFERENCES prestamos(id)
ON DELETE CASCADE,

usuario_id      UUID NOT NULL
REFERENCES usuarios(id),

comentario      TEXT,

resultado       VARCHAR(100),

created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- UN SOLO TELEFONO PRINCIPAL POR CLIENTE
-- ============================================================

CREATE UNIQUE INDEX idx_telefono_principal

ON telefonos_clientes(cliente_id)

WHERE principal = TRUE;

-- ============================================================
-- UNA SOLA DIRECCION PRINCIPAL POR CLIENTE
-- ============================================================

CREATE UNIQUE INDEX idx_direccion_principal

ON direcciones_clientes(cliente_id)

WHERE principal = TRUE;

-- ============================================================
-- UN PRESTAMO ACTIVO POR CLIENTE
-- ============================================================

CREATE UNIQUE INDEX idx_prestamo_activo_cliente

ON prestamos(cliente_id)

WHERE estado IN ('APROBADO', 'ACTIVO');

-- ============================================================
-- INDICES DE NEGOCIO
-- ============================================================

CREATE INDEX idx_clientes_empresa
ON clientes(empresa_id);

CREATE INDEX idx_usuarios_empresa
ON usuarios(empresa_id);

CREATE INDEX idx_prestamos_empresa
ON prestamos(empresa_id);

CREATE INDEX idx_prestamos_cobrador
ON prestamos(cobrador_id);

CREATE INDEX idx_pagos_empresa
ON pagos(empresa_id);

CREATE INDEX idx_cobros_empresa
ON cobros_prestamos(empresa_id);

CREATE INDEX idx_gestiones_prestamo
ON gestiones_cobro(prestamo_id);

-- ============================================================
-- UPDATED_AT EMPRESAS
-- ============================================================

CREATE TRIGGER trg_empresas_updated

BEFORE UPDATE ON empresas

FOR EACH ROW

EXECUTE FUNCTION actualizar_updated_at();

-- ============================================================
-- UPDATED_AT CUOTAS
-- ============================================================

CREATE TRIGGER trg_cuotas_updated

BEFORE UPDATE ON cuotas_prestamo

FOR EACH ROW

EXECUTE FUNCTION actualizar_updated_at();

-- ============================================================
-- UPDATED_AT COBROS
-- ============================================================

CREATE TRIGGER trg_cobros_updated

BEFORE UPDATE ON cobros_prestamos

FOR EACH ROW

EXECUTE FUNCTION actualizar_updated_at();

-- ============================================================
-- BLOQUEAR MODIFICACION DE PAGOS APLICADOS
-- ============================================================

CREATE OR REPLACE FUNCTION bloquear_pago_pagado()

RETURNS TRIGGER AS $$

BEGIN

IF OLD.estado = 'PAGADO' THEN

 RAISE EXCEPTION
 'No se puede modificar un pago ya aplicado';

END IF;

RETURN NEW;

END;

$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bloquear_pago_pagado

BEFORE UPDATE ON pagos

FOR EACH ROW

EXECUTE FUNCTION bloquear_pago_pagado();

-- ============================================================
-- VALIDAR QUE EL PAGO NO SUPERE EL BALANCE
-- ============================================================

CREATE OR REPLACE FUNCTION validar_pago_balance()

RETURNS TRIGGER AS $$

DECLARE

v_balance NUMERIC;

BEGIN

SELECT balance_pendiente

INTO v_balance

FROM prestamos

WHERE id = NEW.prestamo_id;

IF NEW.monto > v_balance THEN

 RAISE EXCEPTION
 'El monto pagado supera el balance pendiente';

END IF;

RETURN NEW;

END;

$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_pago_balance

BEFORE INSERT ON pagos

FOR EACH ROW

EXECUTE FUNCTION validar_pago_balance();

-- ============================================================
-- ACTUALIZAR CUOTAS VENCIDAS CON DIAS DE ATRASO
-- ============================================================

CREATE OR REPLACE FUNCTION actualizar_cuotas_vencidas()

RETURNS VOID AS $$

BEGIN

UPDATE cuotas_prestamo

SET

  estado = 'VENCIDO',

  dias_atraso =
  CURRENT_DATE - fecha_vence,

  updated_at = CURRENT_TIMESTAMP

WHERE fecha_vence < CURRENT_DATE

AND estado = 'PENDIENTE';

END;

$$ LANGUAGE plpgsql;

-- ============================================================
-- VISTAS DE REPORTES
-- ============================================================

CREATE VIEW vw_prestamos_activos AS

SELECT *

FROM prestamos

WHERE estado = 'ACTIVO';

CREATE VIEW vw_clientes_morosos AS

SELECT *

FROM clientes

WHERE estado = 'MOROSO';

CREATE VIEW vw_cobros_hoy AS

SELECT *

FROM pagos

WHERE DATE(fecha_pago) = CURRENT_DATE;

-- ⬇️ Agregar al final de schema.sql, en la sección de MEJORAS MULTIEMPRESA
-- (después de la tabla `empresas`, antes o después de `auditoria` — el orden no importa
--  porque `empresas` ya está creada arriba)

-- ============================================================
-- SUCURSALES
-- ============================================================

CREATE TABLE sucursales (

  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  empresa_id      UUID NOT NULL
                   REFERENCES empresas(id)
                   ON DELETE CASCADE,

  nombre          VARCHAR(120) NOT NULL,

  direccion       TEXT NOT NULL,

  telefono        VARCHAR(30),

  estado          BOOLEAN DEFAULT TRUE,

  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  updated_at      TIMESTAMP
);

CREATE INDEX idx_sucursales_empresa
ON sucursales(empresa_id);

-- Reutiliza la función ya existente actualizar_updated_at()
CREATE TRIGGER trg_sucursales_updated

BEFORE UPDATE ON sucursales

FOR EACH ROW

EXECUTE FUNCTION actualizar_updated_at();