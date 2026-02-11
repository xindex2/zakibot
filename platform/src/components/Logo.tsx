export default function Logo({ size = 40, className = '' }: { size?: number, className?: string }) {
    return (
        <img
            src="/logo.png"
            alt="OpenClaw Host"
            width={size}
            height={size}
            className={className}
            style={{ objectFit: 'contain' }}
        />
    );
}
