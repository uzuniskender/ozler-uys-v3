// src/services/_base/errors.ts
// Service katmanı için ortak hata tipi.
//
// Supabase'ten gelen PostgrestError veya raw Error'u uniform ServiceError'a
// sarar; çağıran her zaman aynı şekle güvenebilir:
//   { name: 'ServiceError', message, code?, table?, op?, cause? }
//
// Misafir modu (lib/supabase.ts proxy) `GUEST_BLOCKED` kodu üretir;
// isGuestBlocked() ile ayrıştırılabilir.

export type ServiceOp =
  | 'select'
  | 'insert'
  | 'update'
  | 'delete'
  | 'upsert'
  | 'rpc'
  | 'storage'

interface SupabaseLikeError {
  message?: string
  code?: string
  details?: string | null
  hint?: string | null
}

export class ServiceError extends Error {
  readonly code?: string
  readonly table?: string
  readonly op?: ServiceOp
  readonly details?: string | null
  readonly hint?: string | null

  constructor(
    message: string,
    opts: {
      code?: string
      table?: string
      op?: ServiceOp
      details?: string | null
      hint?: string | null
      cause?: unknown
    } = {},
  ) {
    super(message, { cause: opts.cause })
    this.name = 'ServiceError'
    this.code = opts.code
    this.table = opts.table
    this.op = opts.op
    this.details = opts.details ?? null
    this.hint = opts.hint ?? null
  }
}

/**
 * Supabase çağrısının `error` alanını ServiceError'a çevirip throw eder.
 * `error` null/undefined ise hiçbir şey yapmaz.
 *
 * Kullanım:
 *   const { data, error } = await supabase.from(TABLO).select('*')
 *   wrap(error, { table: TABLO, op: 'select' })
 *   return data ?? []
 */
export function wrap(
  error: SupabaseLikeError | null | undefined,
  ctx: { table: string; op: ServiceOp; message?: string },
): void {
  if (!error) return
  const msg = ctx.message ?? error.message ?? `${ctx.op} hatası (${ctx.table})`
  throw new ServiceError(msg, {
    code: error.code,
    table: ctx.table,
    op: ctx.op,
    details: error.details ?? null,
    hint: error.hint ?? null,
    cause: error,
  })
}

/** Misafir modunda yazma engellenince supabase proxy bu kodu üretir. */
export function isGuestBlocked(
  error: SupabaseLikeError | null | undefined,
): boolean {
  return error?.code === 'GUEST_BLOCKED'
}

/** Postgres unique-violation (kod çakışması, vb.) */
export function isUniqueViolation(err: unknown): boolean {
  if (err instanceof ServiceError) return err.code === '23505'
  return (err as SupabaseLikeError | null)?.code === '23505'
}

/** Postgres foreign-key violation (bağlı kayıt nedeniyle silinemiyor, vb.) */
export function isForeignKeyViolation(err: unknown): boolean {
  if (err instanceof ServiceError) return err.code === '23503'
  return (err as SupabaseLikeError | null)?.code === '23503'
}
