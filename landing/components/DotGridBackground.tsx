const HERO_DOTS = [
  { left: "6%", top: "14%", size: 3, duration: 16, delay: -2.4, opacity: 0.55 },
  { left: "14%", top: "34%", size: 2, duration: 20, delay: -6.2, opacity: 0.45 },
  { left: "21%", top: "62%", size: 3, duration: 18, delay: -4.1, opacity: 0.6 },
  { left: "29%", top: "22%", size: 2, duration: 22, delay: -8.4, opacity: 0.42 },
  { left: "35%", top: "75%", size: 4, duration: 19, delay: -3.5, opacity: 0.62 },
  { left: "43%", top: "15%", size: 3, duration: 21, delay: -10.2, opacity: 0.5 },
  { left: "49%", top: "52%", size: 2, duration: 15, delay: -5.6, opacity: 0.48 },
  { left: "56%", top: "28%", size: 3, duration: 23, delay: -7.3, opacity: 0.58 },
  { left: "63%", top: "68%", size: 2, duration: 17, delay: -1.9, opacity: 0.4 },
  { left: "71%", top: "18%", size: 4, duration: 24, delay: -11.4, opacity: 0.63 },
  { left: "78%", top: "47%", size: 2, duration: 16, delay: -3.8, opacity: 0.46 },
  { left: "86%", top: "73%", size: 3, duration: 20, delay: -9.1, opacity: 0.52 },
  { left: "92%", top: "29%", size: 2, duration: 18, delay: -2.7, opacity: 0.44 },
] as const;

export function DotGridBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      <div className="absolute inset-0 bg-[#0B1120]" />
      <div className="hero-dot-grid absolute inset-0" />
      <div className="hero-dots absolute inset-0" aria-hidden="true">
        {HERO_DOTS.map((dot) => (
          <span
            key={dot.left}
            className="hero-dot"
            style={{
              left: dot.left,
              top: dot.top,
              width: dot.size,
              height: dot.size,
              animationDuration: `${dot.duration}s`,
              animationDelay: `${dot.delay}s`,
              opacity: dot.opacity,
            }}
          />
        ))}
      </div>
      {/* Glowing orbs */}
      <div
        className="animate-pulse-glow absolute rounded-full bg-primary/20 blur-[100px]"
        style={{ width: 400, height: 400, top: "10%", right: "-5%" }}
      />
      <div
        className="animate-pulse-glow absolute rounded-full bg-secondary/15 blur-[120px]"
        style={{
          width: 350,
          height: 350,
          bottom: "15%",
          left: "-8%",
          animationDelay: "3s",
        }}
      />
      <div
        className="animate-pulse-glow absolute rounded-full bg-primary/10 blur-[80px]"
        style={{
          width: 250,
          height: 250,
          top: "50%",
          left: "60%",
          animationDelay: "1.5s",
        }}
      />
    </div>
  );
}
