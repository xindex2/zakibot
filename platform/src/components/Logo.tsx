export default function Logo({ size = 40, className = '' }: { size?: number, className?: string }) {
    return (
        <img
            src="/logo.png"
            alt="MyClaw.Host"
            width={size}
            height={size}
            className={className}
            style={{ objectFit: 'contain' }}
        />
    );
}
