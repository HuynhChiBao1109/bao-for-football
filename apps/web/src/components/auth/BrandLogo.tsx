type BrandLogoProps = {
  className?: string;
  compact?: boolean;
};

export function BrandLogo({ className = '', compact = false }: BrandLogoProps) {
  return (
    <div className={`brand-logo ${compact ? 'brand-logo--compact' : ''} ${className}`.trim()}>
      <img
        src="/app/logo.png"
        alt="RedLock"
        className="brand-logo__image"
        loading="lazy"
      />
      {!compact && (
        <div className="brand-logo__text">
          <p className="brand-logo__title">REDLOCK</p>
          <p className="brand-logo__subtitle">Awaken Ego. Win the Field.</p>
        </div>
      )}
    </div>
  );
}

