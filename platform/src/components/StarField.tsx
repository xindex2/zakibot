import { useMemo } from 'react';

export default function StarField() {
    const stars = useMemo(() => {
        return Array.from({ length: 150 }).map((_, i) => ({
            id: i,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            size: Math.floor(Math.random() * 3) + 1,
            duration: `${Math.random() * 3 + 2}s`,
            delay: `${Math.random() * 5}s`,
        }));
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 bg-[#0a0a0a]">
            {stars.map((star) => (
                <div
                    key={star.id}
                    className={`star star-${star.size} absolute bg-white rounded-full animate-pulse`}
                    style={{
                        top: star.top,
                        left: star.left,
                        width: `${star.size}px`,
                        height: `${star.size}px`,
                        opacity: Math.random() * 0.7 + 0.3,
                        animationDuration: star.duration,
                        animationDelay: star.delay,
                        boxShadow: star.size > 2 ? '0 0 10px rgba(255, 255, 255, 0.5)' : 'none',
                    }}
                />
            ))}
        </div>
    );
}
