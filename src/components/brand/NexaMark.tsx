interface NexaMarkProps {
  size?: number;
  className?: string;
  label?: string;
}

export function NexaMark({ size = 96, className, label }: NexaMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="32" cy="32" r="24" stroke="var(--nexa-primary)" strokeOpacity="0.22" />
      <ellipse
        cx="32"
        cy="32"
        rx="28"
        ry="11"
        transform="rotate(-28 32 32)"
        stroke="var(--nexa-primary)"
        strokeOpacity="0.5"
      />
      <path
        d="M22 42V22L42 42V22"
        stroke="var(--nexa-primary)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="2.5" fill="var(--nexa-secondary)" />
    </svg>
  );
}
