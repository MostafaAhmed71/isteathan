import { APP_NAME, SCHOOL_LOGO_SRC, SCHOOL_NAME } from '../lib/brand'

type SchoolBrandProps = {
  /** hero: login/register | header: page shells | compact: dense bars */
  variant?: 'hero' | 'header' | 'compact'
  /** Show the app name under the school name */
  showAppName?: boolean
  className?: string
}

export function SchoolBrand({
  variant = 'header',
  showAppName = false,
  className = '',
}: SchoolBrandProps) {
  const size =
    variant === 'hero' ? 'h-24 w-24 md:h-28 md:w-28' : variant === 'compact' ? 'h-11 w-11' : 'h-14 w-14'

  const layout =
    variant === 'hero'
      ? 'flex flex-col items-center text-center gap-3'
      : 'flex items-center gap-3 min-w-0'

  const nameClass =
    variant === 'hero'
      ? 'text-base md:text-lg font-bold text-[var(--color-gold)] leading-snug'
      : variant === 'compact'
        ? 'text-sm font-bold text-[var(--color-gold)] leading-snug line-clamp-2'
        : 'text-sm md:text-base font-bold text-[var(--color-gold)] leading-snug'

  return (
    <div className={`${layout} ${className}`}>
      <img
        src={SCHOOL_LOGO_SRC}
        alt={SCHOOL_NAME}
        width={112}
        height={112}
        className={`${size} shrink-0 rounded-full border-2 border-[var(--color-gold)] bg-white object-cover shadow-[0_6px_18px_rgba(0,0,0,0.35)]`}
        decoding="async"
      />
      <div className={variant === 'hero' ? '' : 'min-w-0'}>
        <p className={nameClass}>{SCHOOL_NAME}</p>
        {showAppName ? (
          <p
            className={
              variant === 'hero'
                ? 'brand-title mt-1 text-4xl md:text-5xl'
                : 'brand-title mt-0.5 text-xl md:text-2xl'
            }
          >
            {APP_NAME}
          </p>
        ) : null}
      </div>
    </div>
  )
}
