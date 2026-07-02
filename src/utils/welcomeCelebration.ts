import confetti from "canvas-confetti";

const CELEBRATION_COLORS = [
  "#d4af37",
  "#fceabb",
  "#ff4d8d",
  "#e91e63",
  "#ffd700",
  "#ffffff",
  "#f472b6",
  "#a855f7",
];

export function fireWelcomeCelebration() {
  const duration = 3500;
  const animationEnd = Date.now() + duration;

  const randomInRange = (min: number, max: number) =>
    Math.random() * (max - min) + min;

  confetti({
    particleCount: 140,
    spread: 360,
    startVelocity: 48,
    origin: { x: 0.5, y: 0.45 },
    colors: CELEBRATION_COLORS,
    ticks: 220,
  });

  const sideBurst = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      clearInterval(sideBurst);
      return;
    }

    confetti({
      particleCount: randomInRange(5, 12),
      angle: randomInRange(55, 125),
      spread: randomInRange(55, 80),
      origin: { x: randomInRange(0.05, 0.25), y: randomInRange(0.1, 0.55) },
      colors: CELEBRATION_COLORS,
    });

    confetti({
      particleCount: randomInRange(5, 12),
      angle: randomInRange(55, 125),
      spread: randomInRange(55, 80),
      origin: { x: randomInRange(0.75, 0.95), y: randomInRange(0.1, 0.55) },
      colors: CELEBRATION_COLORS,
    });
  }, 160);

  const rose = confetti.shapeFromText({ text: "🌹", scalar: 2.2 });
  const flower = confetti.shapeFromText({ text: "🌸", scalar: 1.8 });
  const sparkle = confetti.shapeFromText({ text: "✨", scalar: 1.5 });

  window.setTimeout(() => {
    confetti({
      particleCount: 40,
      spread: 170,
      origin: { x: 0.5, y: 0.35 },
      shapes: [rose, flower, sparkle],
      scalar: 2,
    });
  }, 280);

  window.setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 90,
      spread: 360,
      origin: { x: 0.5, y: 0.5 },
      colors: ["#d4af37", "#fceabb", "#ffd700", "#ff4d8d"],
      startVelocity: 38,
    });
  }, 620);
}
