type BrandLogoProps = {
  className?: string;
  compact?: boolean;
};

export function BrandLogo({ className = '', compact = false }: BrandLogoProps) {
  return (
    <div className={`brand-logo ${compact ? 'brand-logo--compact' : ''} ${className}`.trim()}>
      <img
        src="/app/logo.png"
        alt="Football Manager Simulator"
        className="brand-logo__image"
        loading="lazy"
      />
      {!compact && (
        <div className="brand-logo__text">
          <p className="brand-logo__title">Football Manager Simulator</p>
          <p className="brand-logo__subtitle">Strategy • League • Victory</p>
        </div>
      )}
    </div>
  );
}
