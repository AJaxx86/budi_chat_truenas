import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';

// Check if browser supports speech recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function VoiceInput({ onTranscript, disabled = false }) {
    const [isListening, setIsListening] = useState(false);
    const [isSupported, setIsSupported] = useState(true);
    const [error, setError] = useState(null);
    const [interimTranscript, setInterimTranscript] = useState('');
    const recognitionRef = useRef(null);

    useEffect(() => {
        if (!SpeechRecognition) {
            setIsSupported(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsListening(true);
            setError(null);
        };

        recognition.onend = () => {
            setIsListening(false);
            setInterimTranscript('');
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);

            if (event.error === 'not-allowed') {
                setError('Microphone access denied. Please allow microphone permissions.');
            } else if (event.error === 'no-speech') {
                setError('No speech detected. Please try again.');
            } else if (event.error === 'network') {
                setError('Network error. Please check your connection.');
            } else {
                setError(`Error: ${event.error}`);
            }
        };

        recognition.onresult = (event) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += transcript;
                } else {
                    interim += transcript;
                }
            }

            setInterimTranscript(interim);

            if (final) {
                onTranscript(final);
                setInterimTranscript('');
            }
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [onTranscript]);

    const toggleListening = useCallback(() => {
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setError(null);
            try {
                recognitionRef.current.start();
            } catch (e) {
                // Recognition might already be running
                console.error('Failed to start recognition:', e);
            }
        }
    }, [isListening]);

    if (!isSupported) {
        return (
            <button
                type="button"
                disabled
                className="p-2.5 rounded-xl text-dark-600 cursor-not-allowed"
                title="Speech recognition not supported in this browser"
            >
                <MicOff className="w-5 h-5" />
            </button>
        );
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={toggleListening}
                disabled={disabled}
                className={`h-12 w-12 flex items-center justify-center rounded-xl transition-all duration-200 ${isListening
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                    : 'glass-button text-dark-400 hover:text-primary-400'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isListening ? 'Stop listening' : 'Start voice input'}
            >
                {isListening ? (
                    <Mic className="w-5 h-5" />
                ) : (
                    <Mic className="w-5 h-5" />
                )}
            </button>

            {/* Listening indicator */}
            {isListening && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-600 whitespace-nowrap scale-in">
                    <div className="flex items-center gap-2 text-sm">
                        <div className="flex gap-0.5">
                            <span className="w-1 h-3 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-3 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-3 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-dark-300">Listening...</span>
                    </div>
                    {interimTranscript && (
                        <p className="mt-1 text-xs text-dark-400 max-w-[200px] truncate">
                            {interimTranscript}
                        </p>
                    )}
                </div>
            )}

            {/* Error tooltip */}
            {error && !isListening && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-red-900/50 border border-red-500/30 whitespace-nowrap scale-in max-w-[250px]">
                    <div className="flex items-start gap-2 text-sm">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <span className="text-red-300 text-xs">{error}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default VoiceInput;
