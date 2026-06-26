import React, { useState, useEffect } from 'react';

export default function DebtBird({ totalDebt }: { totalDebt: number }) {
  const [showBird, setShowBird] = useState(false);
  const [birdDismissed, setBirdDismissed] = useState(false);
  const [isFlyingOut, setIsFlyingOut] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (totalDebt > 0 && !birdDismissed && !showBird) {
      timer = setTimeout(() => {
        setShowBird(true);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [totalDebt, birdDismissed, showBird]);

  if (!showBird || birdDismissed) return null;

  return (
    <div 
      className={`fixed bottom-6 left-6 z-[9999] cursor-pointer ${isFlyingOut ? 'bird-container-out' : 'bird-container-in'}`}
      style={{ position: 'fixed', zIndex: 9999 }}
      onClick={() => {
        setIsFlyingOut(true);
        setTimeout(() => setBirdDismissed(true), 800);
      }}
    >
      <div className="bird-hover flex items-end gap-3 flex-row" dir="ltr">
        {/* Bird */}
        <div className="text-7xl drop-shadow-2xl bird-flap select-none z-20 relative transform -scale-x-100">
          🦉
        </div>
        
        {/* Speech Bubble */}
        <div className="bg-rose-600 text-white font-extrabold px-5 py-4 rounded-3xl rounded-bl-none shadow-2xl border-4 border-white bubble-pulse mb-8 relative z-10" dir="rtl">
          <div className="absolute -bottom-3 left-4 w-6 h-6 bg-rose-600 border-b-4 border-l-4 border-white transform rotate-45"></div>
          <p className="text-sm">سدد الفلوس اللي عليك!</p>
          <p className="text-yellow-300 mt-1.5 text-base whitespace-nowrap">الديون وصلت {Math.floor(totalDebt).toLocaleString('en-US')}! أنجز!</p>
        </div>
      </div>

      <style>{`
        @keyframes birdSwoopIn {
          0% { transform: translateX(-100vw) translateY(-50vh) rotate(-20deg) scale(0.5); opacity: 0; }
          60% { transform: translateX(5vw) translateY(5vh) rotate(10deg) scale(1.1); opacity: 1; }
          80% { transform: translateX(-1vw) translateY(-1vh) rotate(-5deg) scale(0.95); }
          100% { transform: translateX(0) translateY(0) rotate(0deg) scale(1); opacity: 1; }
        }
        @keyframes birdFlyOut {
          0% { transform: translateX(0) translateY(0) scale(1); opacity: 1; }
          100% { transform: translateX(100vw) translateY(-100vh) scale(0.5) rotate(45deg); opacity: 0; }
        }
        @keyframes birdHover {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes birdFlap {
          0%, 100% { transform: rotate(-5deg) scaleX(-1); }
          50% { transform: rotate(5deg) scaleX(-1); }
        }
        @keyframes bubblePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        .bird-container-in {
          animation: birdSwoopIn 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .bird-container-out {
          animation: birdFlyOut 0.8s cubic-bezier(0.5, 0, 1, 1) forwards;
        }
        .bird-hover {
          animation: birdHover 2.5s ease-in-out infinite;
        }
        .bird-flap {
          display: inline-block;
          animation: birdFlap 0.4s ease-in-out infinite;
        }
        .bubble-pulse {
          animation: bubblePulse 2s ease-in-out infinite;
          transform-origin: bottom left;
        }
      `}</style>
    </div>
  );
}
