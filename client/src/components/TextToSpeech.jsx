import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Pause, Play, Square, Settings2 } from 'lucide-react';

function TextToSpeech({ text, messageId }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isSupported, setIsSupported] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [voices, setVoices] = useState([]);
    const [selectedVoice, setSelectedVoice] = useState(null);
    const [rate, setRate] = useState(() => {
        const saved = localStorage.getItem('tts_rate');
        return saved ? parseFloat(saved) : 1;
    });
    const [pitch, setPitch] = useState(() => {
        const saved = localStorage.getItem('tts_pitch');
        return saved ? parseFloat(saved) : 1;
    });

    const utteranceRef = useRef(null);
    const settingsRef = useRef(null);

    useEffect(() => {
        if (!window.speechSynthesis) {
            setIsSupported(false);
            return;
        }

        const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            setVoices(availableVoices);

            // Try to restore saved voice or pick a default
            const savedVoiceName = localStorage.getItem('tts_voice');
            if (savedVoiceName) {
                const saved = availableVoices.find(v => v.name === savedVoiceName);
                if (saved) {
                    setSelectedVoice(saved);
                    return;
                }
            }

            // Default to first English voice
            const englishVoice = availableVoices.find(v => v.lang.startsWith('en'));
            if (englishVoice) {
                setSelectedVoice(englishVoice);
            }
        };

        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;

        return () => {
            window.speechSynthesis.cancel();
        };
    }, []);

    // Close settings when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setShowSettings(false);
            }
        };
        if (showSettings) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showSettings]);

    // Strip markdown for cleaner speech
    const cleanText = useCallback((text) => {
        if (!text) return '';
        return text
            .replace(/```[\s\S]*?```/g, 'code block omitted')  // Remove code blocks
            .replace(/`([^`]+)`/g, '$1')  // Inline code
            .replace(/#{1,6}\s?/g, '')  // Headers
            .replace(/\*\*(.+?)\*\*/g, '$1')  // Bold
            .replace(/\*(.+?)\*/g, '$1')  // Italic
            .replace(/__(.+?)__/g, '$1')  // Bold alt
            .replace(/_(.+?)_/g, '$1')  // Italic alt
            .replace(/\[(.+?)\]\(.+?\)/g, '$1')  // Links
            .replace(/!\[.*?\]\(.+?\)/g, '')  // Images
            .replace(/^\s*[-*+]\s/gm, '')  // Unordered lists
            .replace(/^\s*\d+\.\s/gm, '')  // Ordered lists
            .replace(/>\s?/g, '')  // Blockquotes
            .replace(/---/g, '')  // Horizontal rules
            .replace(/\n{2,}/g, '. ')  // Multiple newlines to pauses
            .replace(/\n/g, ' ')  // Single newlines to spaces
            .trim();
    }, []);

    const speak = useCallback(() => {
        if (!window.speechSynthesis || !text) return;

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const cleanedText = cleanText(text);
        const utterance = new SpeechSynthesisUtterance(cleanedText);

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        utterance.rate = rate;
        utterance.pitch = pitch;

        utterance.onstart = () => {
            setIsPlaying(true);
            setIsPaused(false);
        };

        utterance.onend = () => {
            setIsPlaying(false);
            setIsPaused(false);
        };

        utterance.onerror = (event) => {
            console.error('TTS error:', event);
            setIsPlaying(false);
            setIsPaused(false);
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
    }, [text, selectedVoice, rate, pitch, cleanText]);

    const pause = useCallback(() => {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            window.speechSynthesis.pause();
            setIsPaused(true);
        }
    }, []);

    const resume = useCallback(() => {
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
            setIsPaused(false);
        }
    }, []);

    const stop = useCallback(() => {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
        setIsPaused(false);
    }, []);

    const handleVoiceChange = (e) => {
        const voice = voices.find(v => v.name === e.target.value);
        setSelectedVoice(voice);
        localStorage.setItem('tts_voice', voice?.name || '');
    };

    const handleRateChange = (e) => {
        const newRate = parseFloat(e.target.value);
        setRate(newRate);
        localStorage.setItem('tts_rate', newRate.toString());
    };

    const handlePitchChange = (e) => {
        const newPitch = parseFloat(e.target.value);
        setPitch(newPitch);
        localStorage.setItem('tts_pitch', newPitch.toString());
    };

    if (!isSupported) {
        return null;
    }

    return (
        <div className="relative inline-flex items-center gap-1">
            {!isPlaying ? (
                <button
                    type="button"
                    onClick={speak}
                    className="p-1.5 rounded-lg text-dark-500 hover:text-primary-400 hover:bg-white/[0.03] transition-colors"
                    title="Read aloud"
                >
                    <Volume2 className="w-4 h-4" />
                </button>
            ) : (
                <>
                    {isPaused ? (
                        <button
                            type="button"
                            onClick={resume}
                            className="p-1.5 rounded-lg text-primary-400 hover:bg-white/[0.03] transition-colors"
                            title="Resume"
                        >
                            <Play className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={pause}
                            className="p-1.5 rounded-lg text-primary-400 hover:bg-white/[0.03] transition-colors"
                            title="Pause"
                        >
                            <Pause className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={stop}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-white/[0.03] transition-colors"
                        title="Stop"
                    >
                        <Square className="w-3.5 h-3.5" />
                    </button>
                </>
            )}

            {/* Settings button */}
            <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-lg transition-colors ${showSettings
                        ? 'text-primary-400 bg-white/[0.03]'
                        : 'text-dark-500 hover:text-dark-400 hover:bg-white/[0.03]'
                    }`}
                title="Voice settings"
            >
                <Settings2 className="w-3.5 h-3.5" />
            </button>

            {/* Settings dropdown */}
            {showSettings && (
                <div
                    ref={settingsRef}
                    className="absolute bottom-full right-0 mb-2 p-4 w-64 bg-dark-900 border border-dark-700 rounded-xl shadow-2xl z-50 scale-in"
                >
                    <h4 className="text-sm font-medium text-dark-200 mb-3">Voice Settings</h4>

                    {/* Voice selection */}
                    <div className="mb-3">
                        <label className="block text-xs text-dark-500 mb-1">Voice</label>
                        <select
                            value={selectedVoice?.name || ''}
                            onChange={handleVoiceChange}
                            className="w-full px-2 py-1.5 text-sm rounded-lg bg-dark-800 border border-dark-600 text-dark-200 focus:border-primary-500/50 focus:outline-none"
                        >
                            {voices.map((voice) => (
                                <option key={voice.name} value={voice.name}>
                                    {voice.name} ({voice.lang})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Speed */}
                    <div className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs text-dark-500">Speed</label>
                            <span className="text-xs text-dark-400">{rate.toFixed(1)}x</span>
                        </div>
                        <input
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.1"
                            value={rate}
                            onChange={handleRateChange}
                            className="w-full"
                        />
                    </div>

                    {/* Pitch */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs text-dark-500">Pitch</label>
                            <span className="text-xs text-dark-400">{pitch.toFixed(1)}</span>
                        </div>
                        <input
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.1"
                            value={pitch}
                            onChange={handlePitchChange}
                            className="w-full"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default TextToSpeech;
