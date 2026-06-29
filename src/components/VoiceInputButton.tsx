import React, { useState, useRef, useEffect } from 'react';
import { Mic } from 'lucide-react';

interface VoiceInputButtonProps {
  onResult: (text: string) => void;
  className?: string;
  lang?: string;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({ 
  onResult, 
  className = "",
  lang = "ar-LY" 
}) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = lang;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        // Append a space so that it doesn't merge directly with existing text without spacing, 
        // or just let the parent handle the concatenation. We'll pass the raw transcript.
        onResult(transcript);
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
          alert("الرجاء السماح بالوصول إلى الميكروفون لاستخدام هذه الميزة.");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [lang, onResult]);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!recognitionRef.current) {
      alert("عذراً، متصفحك الحالي لا يدعم ميزة الإدخال الصوتي.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start speech recognition", err);
      }
    }
  };

  if (typeof window === 'undefined' || !('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`p-1.5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${
        isListening 
          ? 'bg-rose-100 text-rose-600 animate-pulse border border-rose-300' 
          : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200'
      } ${className}`}
      title={isListening ? "جاري الاستماع... (انقر للإيقاف)" : "استخدام الميكروفون للإدخال الصوتي"}
    >
      <Mic className="w-4 h-4" />
    </button>
  );
};
