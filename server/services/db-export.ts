/**
 * Exportación completa de la base de datos PostgreSQL a un archivo .sql.
 *
 * Genera un volcado autocontenido (equivalente a `pg_dump --clean`) que se puede
 * restaurar en cualquier servidor PostgreSQL —incluido un VPS de Hostinger— con:
 *
 *     psql "postgresql://usuario:pass@host:5432/basededatos" < backup.sql
 *
 * No depende del binario `pg_dump` (no existe en las funciones serverless de
 * Vercel): todo se reconstruye leyendo el catálogo del propio PostgreSQL.
 *
 * Los valores se serializan en el servidor de base de datos con
 * `quote_nullable(columna::text)`. Así el escapado de comillas, saltos de línea,
 * JSON, arrays y fechas lo hace PostgreSQL y no código JavaScript propenso a
 * errores: cada literal vuelve ya citado y listo para un INSERT.
 */

interface QueryablePool {
  query(text: string, values?: any[]): Promise<{ rows: any[] }>;
}

interface ColumnRow {
  table_name: string;
  column_name: string;
  col_type: string;
  not_null: boolean;
  col_default: string | null;
}

interface ConstraintRow {
  table_name: string;
  conname: string;
  def: string;
  contype: string;
}

export interface DumpOptions {
  /** Incluye los INSERT con los datos. Si es false solo se exporta la estructura. */
  includeData?: boolean;
  /** Filas por sentencia INSERT multi-valor. */
  batchSize?: number;
}

export interface DumpResult {
  sql: string;
  tableCount: number;
  rowCount: number;
}

/** Cita un identificador (tabla/columna) para SQL. */
function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Ordena las tablas topológicamente según sus claves foráneas para que los
 * INSERT de una tabla hija ocurran después de los de su padre. Las
 * restricciones se crean al final del volcado, así que esto es solo una mejora
 * de legibilidad y robustez; los ciclos se resuelven dejando el orden original.
 */
function sortTablesByDependency(tables: string[], fks: ConstraintRow[]): string[] {
  const deps = new Map<string, Set<string>>();
  for (const table of tables) deps.set(table, new Set());

  for (const fk of fks) {
    // pg_get_constraintdef: FOREIGN KEY (col) REFERENCES tabla(col) ...
    const match = /REFERENCES\s+([^\s(]+)/i.exec(fk.def);
    if (!match) continue;
    const referenced = match[1].replace(/"/g, '').replace(/^public\./, '');
    if (referenced === fk.table_name) continue; // autorreferencia
    deps.get(fk.table_name)?.add(referenced);
  }

  const ordered: string[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();

  const visit = (table: string) => {
    if (done.has(table) || visiting.has(table)) return;
    visiting.add(table);
    for (const dep of Array.from(deps.get(table) ?? [])) {
      if (deps.has(dep)) visit(dep);
    }
    visiting.delete(table);
    done.add(table);
    ordered.push(table);
  };

  for (const table of tables) visit(table);
  return ordered;
}

export async function generateSqlDump(
  pool: QueryablePool,
  options: DumpOptions = {},
): Promise<DumpResult> {
  const includeData = options.includeData !== false;
  const batchSize = options.batchSize && options.batchSize > 0 ? options.batchSize : 200;

  // --- 1. Estructura de columnas (format_type da el tipo exacto, con longitud) ---
  const { rows: columns } = (await pool.query(`
    SELECT c.relname                              AS table_name,
           a.attname                              AS column_name,
           format_type(a.atttypid, a.atttypmod)   AS col_type,
           a.attnotnull                           AS not_null,
           pg_get_expr(d.adbin, d.adrelid)        AS col_default
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname, a.attnum
  `)) as { rows: ColumnRow[] };

  // --- 2. Restricciones (PK, UNIQUE, CHECK, FK) ---
  const { rows: constraints } = (await pool.query(`
    SELECT t.relname                    AS table_name,
           con.conname                  AS conname,
           pg_get_constraintdef(con.oid) AS def,
           con.contype                  AS contype
    FROM pg_constraint con
    JOIN pg_class t ON t.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND con.contype IN ('p', 'u', 'f', 'c')
    ORDER BY t.relname, con.conname
  `)) as { rows: ConstraintRow[] };

  // --- 3. Índices que NO provienen de una restricción ---
  const { rows: indexes } = await pool.query(`
    SELECT i.tablename, i.indexname, i.indexdef
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint con
        JOIN pg_class t ON t.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND con.conname = i.indexname AND t.relname = i.tablename
      )
    ORDER BY i.tablename, i.indexname
  `);

  // --- 4. Secuencias (las que respaldan las columnas serial) ---
  const { rows: sequences } = await pool.query(`
    SELECT c.relname AS sequence_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
    ORDER BY c.relname
  `);

  // Propietario de cada secuencia (tabla.columna) para restaurar el OWNED BY.
  const { rows: seqOwners } = await pool.query(`
    SELECT s.relname AS sequence_name, t.relname AS table_name, a.attname AS column_name
    FROM pg_class s
    JOIN pg_namespace n ON n.oid = s.relnamespace
    JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass AND d.deptype = 'a'
    JOIN pg_class t ON t.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
    WHERE n.nspname = 'public' AND s.relkind = 'S'
  `);

  const columnsByTable = new Map<string, ColumnRow[]>();
  for (const col of columns) {
    const list = columnsByTable.get(col.table_name) ?? [];
    list.push(col);
    columnsByTable.set(col.table_name, list);
  }

  const fks = constraints.filter((c) => c.contype === 'f');
  const tableNames = sortTablesByDependency(Array.from(columnsByTable.keys()).sort(), fks);

  const out: string[] = [];
  const stamp = new Date().toISOString();

  out.push(`--`);
  out.push(`-- Respaldo completo de la base de datos (PostgreSQL)`);
  out.push(`-- Generado el: ${stamp}`);
  out.push(`-- Tablas: ${tableNames.length}`);
  out.push(`--`);
  out.push(`-- Restaurar en otro servidor (por ejemplo un VPS de Hostinger):`);
  out.push(`--   psql "postgresql://usuario:password@host:5432/basededatos" < backup.sql`);
  out.push(`--`);
  out.push(`-- ATENCION: este archivo ELIMINA (DROP) las tablas existentes antes de`);
  out.push(`-- recrearlas. Restauralo unicamente en una base de datos vacia o de la`);
  out.push(`-- que ya tengas otro respaldo.`);
  out.push(`--`);
  out.push(``);
  out.push(`SET statement_timeout = 0;`);
  out.push(`SET client_encoding = 'UTF8';`);
  out.push(`SET standard_conforming_strings = on;`);
  out.push(`SET check_function_bodies = false;`);
  out.push(`SET client_min_messages = warning;`);
  out.push(``);
  out.push(`BEGIN;`);
  out.push(``);

  // --- Limpieza previa ---
  out.push(`-- ============================================================`);
  out.push(`-- 1. Eliminar objetos existentes`);
  out.push(`-- ============================================================`);
  for (const table of [...tableNames].reverse()) {
    out.push(`DROP TABLE IF EXISTS ${ident(table)} CASCADE;`);
  }
  out.push(``);

  // --- Secuencias ---
  if (sequences.length) {
    out.push(`-- ============================================================`);
    out.push(`-- 2. Secuencias`);
    out.push(`-- ============================================================`);
    for (const seq of sequences) {
      out.push(`DROP SEQUENCE IF EXISTS ${ident(seq.sequence_name)} CASCADE;`);
      out.push(`CREATE SEQUENCE ${ident(seq.sequence_name)};`);
    }
    out.push(``);
  }

  // --- Tablas ---
  out.push(`-- ============================================================`);
  out.push(`-- 3. Estructura de las tablas`);
  out.push(`-- ============================================================`);
  for (const table of tableNames) {
    const cols = columnsByTable.get(table) ?? [];
    const defs = cols.map((col) => {
      let line = `  ${ident(col.column_name)} ${col.col_type}`;
      if (col.col_default !== null) line += ` DEFAULT ${col.col_default}`;
      if (col.not_null) line += ` NOT NULL`;
      return line;
    });
    out.push(`CREATE TABLE ${ident(table)} (`);
    out.push(defs.join(',\n'));
    out.push(`);`);
    out.push(``);
  }

  // --- Datos ---
  let totalRows = 0;
  if (includeData) {
    out.push(`-- ============================================================`);
    out.push(`-- 4. Datos`);
    out.push(`-- ============================================================`);
    for (const table of tableNames) {
      const cols = columnsByTable.get(table) ?? [];
      if (!cols.length) continue;

      // PostgreSQL serializa y escapa cada valor: quote_nullable devuelve el
      // literal ya citado, o la palabra NULL cuando el valor es nulo.
      const valueExpr = cols
        .map((col) => `quote_nullable(${ident(col.column_name)}::text)`)
        .join(` || ', ' || `);
      const orderBy = cols.some((c) => c.column_name === 'id') ? ' ORDER BY "id"' : '';

      const { rows } = await pool.query(
        `SELECT ${valueExpr} AS row_literal FROM ${ident(table)}${orderBy}`,
      );

      if (!rows.length) {
        out.push(`-- ${table}: sin registros`);
        out.push(``);
        continue;
      }

      totalRows += rows.length;
      const columnList = cols.map((c) => ident(c.column_name)).join(', ');
      out.push(`-- ${table}: ${rows.length} registro(s)`);

      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);
        out.push(`INSERT INTO ${ident(table)} (${columnList}) VALUES`);
        out.push(chunk.map((r) => `  (${r.row_literal})`).join(',\n') + ';');
      }
      out.push(``);
    }
  }

  // --- Restricciones: primero PK/UNIQUE/CHECK, después las foráneas ---
  out.push(`-- ============================================================`);
  out.push(`-- 5. Claves primarias, unicidad y validaciones`);
  out.push(`-- ============================================================`);
  for (const con of constraints.filter((c) => c.contype !== 'f')) {
    out.push(
      `ALTER TABLE ${ident(con.table_name)} ADD CONSTRAINT ${ident(con.conname)} ${con.def};`,
    );
  }
  out.push(``);

  if (fks.length) {
    out.push(`-- ============================================================`);
    out.push(`-- 6. Claves foraneas`);
    out.push(`-- ============================================================`);
    for (const con of fks) {
      out.push(
        `ALTER TABLE ${ident(con.table_name)} ADD CONSTRAINT ${ident(con.conname)} ${con.def};`,
      );
    }
    out.push(``);
  }

  if (indexes.length) {
    out.push(`-- ============================================================`);
    out.push(`-- 7. Indices`);
    out.push(`-- ============================================================`);
    for (const idx of indexes) {
      out.push(`${idx.indexdef};`);
    }
    out.push(``);
  }

  // --- Secuencias: propietario y valor actual ---
  if (sequences.length) {
    out.push(`-- ============================================================`);
    out.push(`-- 8. Estado de las secuencias`);
    out.push(`-- ============================================================`);
    for (const owner of seqOwners) {
      out.push(
        `ALTER SEQUENCE ${ident(owner.sequence_name)} OWNED BY ${ident(owner.table_name)}.${ident(owner.column_name)};`,
      );
    }
    const ownerBySequence = new Map<string, { table: string; column: string }>();
    for (const owner of seqOwners) {
      ownerBySequence.set(owner.sequence_name, {
        table: owner.table_name,
        column: owner.column_name,
      });
    }

    for (const seq of sequences) {
      const { rows } = await pool.query(
        `SELECT last_value, is_called FROM ${ident(seq.sequence_name)}`,
      );
      const lastValue = BigInt(rows[0]?.last_value ?? 1);
      const isCalled = Boolean(rows[0]?.is_called);

      // Último valor REALMENTE entregado: si is_called es false, la secuencia
      // todavía no ha servido last_value.
      const ONE = BigInt(1);
      let target = isCalled ? lastValue : lastValue - ONE;

      // Una secuencia por detrás del mayor id de su tabla es un estado roto:
      // el primer INSERT tras restaurar fallaría con "duplicate key". Ocurre
      // cuando los datos se insertaron con ids explícitos. Se corrige aquí para
      // que la base restaurada quede siempre operativa.
      const owner = ownerBySequence.get(seq.sequence_name);
      if (owner) {
        try {
          const { rows: maxRows } = await pool.query(
            `SELECT COALESCE(MAX(${ident(owner.column)}), 0)::bigint AS max_value FROM ${ident(owner.table)}`,
          );
          const maxData = BigInt(maxRows[0]?.max_value ?? 0);
          if (maxData > target) {
            console.warn(
              `[db-export] La secuencia ${seq.sequence_name} estaba en ${target} pero ${owner.table}.${owner.column} llega a ${maxData}. Se corrige en el respaldo para evitar errores de clave duplicada.`,
            );
            target = maxData;
          }
        } catch {
          // Columna no numérica o tabla inaccesible: se conserva el valor original.
        }
      }

      const seqLiteral = `'public.${seq.sequence_name.replace(/'/g, "''")}'`;
      if (target < ONE) {
        // Aún no se ha entregado ningún valor: el próximo debe ser el primero.
        out.push(`SELECT pg_catalog.setval(${seqLiteral}, 1, false);`);
      } else {
        out.push(`SELECT pg_catalog.setval(${seqLiteral}, ${target}, true);`);
      }
    }
    out.push(``);
  }

  out.push(`COMMIT;`);
  out.push(``);
  out.push(`-- Fin del respaldo.`);
  out.push(``);

  return {
    sql: out.join('\n'),
    tableCount: tableNames.length,
    rowCount: totalRows,
  };
}

/** Nombre de archivo sugerido: backup-directorio-2026-09-24-1530.sql */
export function buildDumpFilename(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`;
  return `backup-directorio-${stamp}.sql`;
}
