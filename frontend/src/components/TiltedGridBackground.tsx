import { useEffect, useRef } from 'react';

export const TiltedGridBackground = () => {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;

    const updatePosition = () => {
      if (gridRef.current) {
        const moveX = window.scrollY * 0.5;
        gridRef.current.style.transform = `perspective(1000px) rotateX(50deg) rotateZ(-20deg) translate(${moveX}px, 0px)`;
      }
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updatePosition);
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    updatePosition(); // Initial set
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div 
        ref={gridRef}
        className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] opacity-50 will-change-transform"
        style={{
          transform: `perspective(1000px) rotateX(60deg) rotateZ(-30deg) translate(0px, 0px)`,
          backgroundSize: '60px 60px',
          backgroundImage: `
            linear-gradient(to right, rgba(94, 106, 210, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(94, 106, 210, 0.15) 1px, transparent 1px)
          `,
          maskImage: 'radial-gradient(circle at center, black 10%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black 10%, transparent 70%)'
        }}
      ></div>
    </div>
  );
};
