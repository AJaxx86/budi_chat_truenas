import React, { useState } from 'react';
import { Wand2, X, Loader2, Settings2, Download, ExternalLink } from 'lucide-react';

function ImageGeneration({ chatId, onImageGenerated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    size: '1024x1024',
    quality: 'standard'
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          chat_id: chatId,
          size: settings.size,
          quality: settings.quality
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate image');
      }

      if (data.success) {
        setResult(data);
        if (onImageGenerated) {
          onImageGenerated(data);
        }
      } else {
        // Model returned text instead of image
        setError(data.message || 'Model did not return an image');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!result?.url) return;

    try {
      const res = await fetch(result.url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-${result.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setPrompt('');
    setResult(null);
    setError(null);
    setShowSettings(false);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-12 h-12 rounded-xl glass-button text-dark-400 hover:text-accent-400 transition-all duration-200 flex items-center justify-center"
        title="Generate Image"
      >
        <Wand2 className="w-5 h-5" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-md flex items-center justify-center z-50 scale-in">
          <div className="glass-card rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-primary-500 flex items-center justify-center">
                  <Wand2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-dark-100">Generate Image</h3>
                  <p className="text-xs text-dark-500">AI-powered image creation</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-lg transition-all ${showSettings ? 'bg-primary-500/10 text-primary-400' : 'text-dark-400 hover:text-dark-200'
                    }`}
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-white/[0.05] rounded-lg transition-all"
                >
                  <X className="w-5 h-5 text-dark-400" />
                </button>
              </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
              <div className="p-4 bg-dark-800/50 border-b border-white/[0.06]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-dark-400 mb-1.5">Size</label>
                    <select
                      value={settings.size}
                      onChange={(e) => setSettings(s => ({ ...s, size: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/[0.08] text-dark-200 text-sm"
                    >
                      <option value="1024x1024">1024x1024 (Square)</option>
                      <option value="1792x1024">1792x1024 (Landscape)</option>
                      <option value="1024x1792">1024x1792 (Portrait)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-dark-400 mb-1.5">Quality</label>
                    <select
                      value={settings.quality}
                      onChange={(e) => setSettings(s => ({ ...s, quality: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/[0.08] text-dark-200 text-sm"
                    >
                      <option value="standard">Standard</option>
                      <option value="hd">HD</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="p-4">
              {/* Prompt Input */}
              <div className="mb-4">
                <label className="block text-sm text-dark-300 mb-2">Describe the image you want</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A serene mountain landscape at sunset with a lake reflection..."
                  className="w-full px-4 py-3 rounded-xl glass-input text-dark-100 placeholder-dark-500 text-sm resize-none"
                  rows={3}
                  disabled={generating}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Result */}
              {result && (
                <div className="mb-4">
                  <div className="relative rounded-xl overflow-hidden bg-dark-800">
                    <img
                      src={`${result.url}?token=${localStorage.getItem('token')}`}
                      alt={result.prompt}
                      className="w-full"
                      onError={(e) => {
                        // If direct URL fails, try fetching with auth
                        e.target.style.display = 'none';
                      }}
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <button
                        onClick={handleDownload}
                        className="p-2 bg-dark-900/80 backdrop-blur-sm rounded-lg hover:bg-dark-800 transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-dark-300" />
                      </button>
                      <button
                        onClick={() => window.open(result.url, '_blank')}
                        className="p-2 bg-dark-900/80 backdrop-blur-sm rounded-lg hover:bg-dark-800 transition-colors"
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-4 h-4 text-dark-300" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-dark-500 mt-2 text-center">
                    Generated with {result.model}
                  </p>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || generating}
                className="w-full py-3 rounded-xl gradient-primary text-white font-semibold hover:shadow-glow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generate Image
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ImageGeneration;
