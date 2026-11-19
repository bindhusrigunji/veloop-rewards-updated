import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { X, Dices, Trophy, Sparkles, Coins, Gem, CircleDollarSign } from 'lucide-react';

export const FortuneWheelModal: React.FC = () => {
  const { isWheelModalOpen, setIsWheelModalOpen, wallet, refreshWallet } = useAuth();
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<{ label: string; currency: string; amount: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isWheelModalOpen) return null;

  const slices = [
    { label: '300 VEs', color: '#800020', text: '#FFF9F0' },
    { label: '15 Gems', color: '#172554', text: '#F4C542' },
    { label: '500 VEs', color: '#4169E1', text: '#FFFFFF' },
    { label: '50 Tokens', color: '#16A34A', text: '#FFFFFF' },
    { label: '1,000 VEs', color: '#F4C542', text: '#172554' },
    { label: '100 SVEs', color: '#7c3aed', text: '#FFFFFF' }
  ];

  const handleSpin = async () => {
    if (isSpinning) return;
    if (!wallet || wallet.spins < 1) {
      setErrorMessage('You need at least 1 Spin to play! Claim your daily reward to get more spins.');
      return;
    }

    setErrorMessage(null);
    setWonPrize(null);
    setIsSpinning(true);

    try {
      const res = await api.spinWheel();
      
      // Calculate random rotation that spins several full rounds plus an offset
      const extraSpins = 5 + Math.floor(Math.random() * 3);
      const randomAngle = Math.floor(Math.random() * 360);
      const targetRotation = rotation + extraSpins * 360 + randomAngle;
      
      setRotation(targetRotation);

      setTimeout(async () => {
        setIsSpinning(false);
        setWonPrize(res.prize);
        await refreshWallet();
      }, 3500);
    } catch (err: any) {
      setIsSpinning(false);
      setErrorMessage(err.message || 'Spin failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-amber-200/50">
        {/* Header */}
        <div className="bg-[#172554] p-4 text-white flex items-center justify-between border-b border-blue-900">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F4C542] text-slate-950 flex items-center justify-center font-bold">
              <Dices className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">VELoop Fortune Wheel</h3>
              <p className="text-xs text-blue-200">Spin to win VEs, Gems & Tokens</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (!isSpinning) setIsWheelModalOpen(false);
            }}
            disabled={isSpinning}
            className="p-1 rounded-lg text-blue-300 hover:text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 bg-[#FFF9F0] flex flex-col items-center">
          {/* Spins available pill */}
          <div className="mb-4 px-3 py-1 bg-amber-100 border border-amber-300 rounded-full text-xs font-semibold text-amber-900 flex items-center gap-1.5 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Spins Available: {wallet?.spins ?? 0}</span>
          </div>

          {errorMessage && (
            <div className="w-full mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs text-center">
              {errorMessage}
            </div>
          )}

          {wonPrize && (
            <div className="w-full mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-center animate-fade-in">
              <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-emerald-700 mb-0.5">
                <Trophy className="w-4 h-4 text-[#F4C542]" />
                <span>Winner!</span>
              </div>
              <p className="text-xs">
                You won <strong className="text-emerald-800">{wonPrize.label}</strong>! Added to your wallet.
              </p>
            </div>
          )}

          {/* Wheel Graphic */}
          <div className="relative w-64 h-64 my-2 flex items-center justify-center">
            {/* Top Indicator Arrow */}
            <div className="absolute -top-3 z-20 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-[#800020] drop-shadow-md" />

            {/* Rotating SVG Wheel */}
            <div
              className="w-56 h-56 rounded-full shadow-xl border-4 border-white overflow-hidden transition-transform duration-[3500ms] ease-out"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {slices.map((slice, idx) => {
                  const angle = 360 / slices.length;
                  const startAngle = idx * angle;
                  const endAngle = (idx + 1) * angle;

                  const x1 = 50 + 50 * Math.cos((Math.PI * (startAngle - 90)) / 180);
                  const y1 = 50 + 50 * Math.sin((Math.PI * (startAngle - 90)) / 180);
                  const x2 = 50 + 50 * Math.cos((Math.PI * (endAngle - 90)) / 180);
                  const y2 = 50 + 50 * Math.sin((Math.PI * (endAngle - 90)) / 180);

                  const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`;

                  const textAngle = startAngle + angle / 2;
                  const tx = 50 + 32 * Math.cos((Math.PI * (textAngle - 90)) / 180);
                  const ty = 50 + 32 * Math.sin((Math.PI * (textAngle - 90)) / 180);

                  return (
                    <g key={idx}>
                      <path d={pathData} fill={slice.color} stroke="#ffffff" strokeWidth="0.8" />
                      <text
                        x={tx}
                        y={ty}
                        fill={slice.text}
                        fontSize="4.5"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${textAngle + 90}, ${tx}, ${ty})`}
                      >
                        {slice.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Center Cap */}
            <div className="absolute w-12 h-12 rounded-full bg-gradient-to-tr from-[#172554] to-[#4169E1] border-2 border-white flex items-center justify-center shadow-lg z-10 pointer-events-none">
              <Sparkles className="w-5 h-5 text-[#F4C542]" />
            </div>
          </div>

          {/* Action Button */}
          <div className="w-full mt-4">
            <button
              onClick={handleSpin}
              disabled={isSpinning || !wallet || wallet.spins < 1}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                wallet && wallet.spins > 0 && !isSpinning
                  ? 'bg-gradient-to-r from-[#800020] via-red-700 to-[#800020] text-white hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Dices className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
              <span>{isSpinning ? 'Spinning Wheel...' : 'Spin the Wheel (-1 Spin)'}</span>
            </button>
            <p className="text-[11px] text-center text-slate-500 mt-2">
              Every spin is cryptographically verified and recorded in your wallet ledger.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
