import React, { useRef, useState } from 'react';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number; // max tilt degrees (default 8)
  scale?: number; // scale on hover (default 1.025)
}

const TiltCard: React.FC<TiltCardProps> = ({ children, className = '', maxTilt = 8, scale = 1.025 }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
    transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)'
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left; // cursor X position within card
    const y = e.clientY - rect.top; // cursor Y position within card

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate rotation degree based on relative distance from center
    const rotateX = ((centerY - y) / centerY) * maxTilt; // vertical tilt
    const rotateY = ((x - centerX) / centerX) * maxTilt; // horizontal tilt

    setStyle({
      transform: `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`,
      transition: 'transform 0.1s ease-out', // quick reaction during movement
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12), 0 0 30px rgba(99, 102, 241, 0.15)' // glowing spotlight shadow
    });
  };

  const handleMouseLeave = () => {
    setStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)', // smooth spring reset
      boxShadow: 'none'
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`transition-all duration-300 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
};

export default TiltCard;
