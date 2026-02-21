import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Brain, Plus, Trash2, Edit2, Save, X, Star, Image as ImageIcon, Upload, ZoomIn, AlertTriangle } from 'lucide-react';

function Memories() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showNewMemory, setShowNewMemory] = useState(false);
  const [formData, setFormData] = useState({
    content: '',
    category: 'general',
    importance: 1
  });
  const [pendingImages, setPendingImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [imagesToRemove, setImagesToRemove] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    try {
      const res = await fetch('/api/memories', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setMemories(data);
    } catch (error) {
      console.error('Failed to load memories:', error);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length + pendingImages.length + existingImages.length - imagesToRemove.length > 10) {
      alert('Maximum 10 images per memory allowed');
      return;
    }

    const newImages = imageFiles.map(file => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      original_name: file.name,
      size: file.size,
      isNew: true
    }));

    setPendingImages(prev => [...prev, ...newImages]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length + pendingImages.length + existingImages.length - imagesToRemove.length > 10) {
      alert('Maximum 10 images per memory allowed');
      return;
    }

    const newImages = imageFiles.map(file => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      original_name: file.name,
      size: file.size,
      isNew: true
    }));

    setPendingImages(prev => [...prev, ...newImages]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) imageItems.push(blob);
      }
    }

    if (imageItems.length === 0) return;

    if (imageItems.length + pendingImages.length + existingImages.length - imagesToRemove.length > 10) {
      alert('Maximum 10 images per memory allowed');
      return;
    }

    const newImages = imageItems.map((blob, index) => {
      const extension = blob.type.split('/')[1] || 'png';
      const filename = `pasted-${Date.now()}-${index}.${extension}`;
      const file = new File([blob], filename, { type: blob.type });
      
      return {
        id: `temp-${Date.now()}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
        original_name: filename,
        size: file.size,
        isNew: true
      };
    });

    setPendingImages(prev => [...prev, ...newImages]);
  };

  const removePendingImage = (imageId) => {
    const image = pendingImages.find(img => img.id === imageId);
    if (image?.preview) {
      URL.revokeObjectURL(image.preview);
    }
    setPendingImages(prev => prev.filter(img => img.id !== imageId));
  };

  const removeExistingImage = (imageId) => {
    setImagesToRemove(prev => [...prev, imageId]);
    setExistingImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formDataObj = new FormData();
      formDataObj.append('content', formData.content);
      formDataObj.append('category', formData.category);
      formDataObj.append('importance', formData.importance);

      if (editingId) {
        // For updates, send images to remove
        if (imagesToRemove.length > 0) {
          formDataObj.append('remove_image_ids', JSON.stringify(imagesToRemove));
        }
      }

      // Append new images
      pendingImages.forEach(img => {
        if (img.file) {
          formDataObj.append('images', img.file);
        }
      });

      const url = editingId ? `/api/memories/${editingId}` : '/api/memories';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formDataObj
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save memory');
      }

      // Cleanup
      pendingImages.forEach(img => {
        if (img.preview) URL.revokeObjectURL(img.preview);
      });

      setFormData({ content: '', category: 'general', importance: 1 });
      setPendingImages([]);
      setExistingImages([]);
      setImagesToRemove([]);
      setEditingId(null);
      setShowNewMemory(false);
      loadMemories();
    } catch (error) {
      console.error('Failed to save memory:', error);
      alert('Failed to save memory: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (memory) => {
    setFormData({
      content: memory.content,
      category: memory.category,
      importance: memory.importance
    });
    setExistingImages(memory.images || []);
    setPendingImages([]);
    setImagesToRemove([]);
    setEditingId(memory.id);
    setShowNewMemory(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this memory?')) return;

    try {
      await fetch(`/api/memories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      loadMemories();
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  };

  const cancelEdit = () => {
    // Cleanup previews
    pendingImages.forEach(img => {
      if (img.preview) URL.revokeObjectURL(img.preview);
    });
    
    setFormData({ content: '', category: 'general', importance: 1 });
    setPendingImages([]);
    setExistingImages([]);
    setImagesToRemove([]);
    setEditingId(null);
    setShowNewMemory(false);
  };

  const getCategoryColor = (category) => {
    const colors = {
      general: 'bg-dark-700/50 text-dark-300 border-dark-600',
      personal: 'bg-accent/10 text-accent border-accent/20',
      work: 'bg-accent-500/10 text-accent-400 border-accent-500/20',
      preferences: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    };
    return colors[category] || colors.general;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getImageUrl = (image) => {
    const token = localStorage.getItem('token');
    return `/api/uploads/${image.id}?token=${token}`;
  };

  const totalImages = pendingImages.length + existingImages.length;
  const canAddMore = totalImages < 10;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-dark-950 bg-mesh">
      <div className="max-w-4xl mx-auto p-6">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-dark-400 hover:text-dark-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Chat
        </button>

        <div className="glass-card rounded-2xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-accent mb-2 flex items-center gap-3 tracking-tight">
                <Brain className="w-8 h-8" />
                Memories
              </h1>
              <p className="text-dark-400">
                Store important context that the AI can reference in conversations
              </p>
            </div>

            {!showNewMemory && (
              <button
                onClick={() => setShowNewMemory(true)}
                className="btn-primary px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Memory
              </button>
            )}
          </div>

          {/* New/Edit Memory Form */}
          {showNewMemory && (
            <form onSubmit={handleSubmit} className="mb-8 p-6 bg-dark-800/50 rounded-xl border border-dark-700/40">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-dark-100">
                  {editingId ? 'Edit Memory' : 'New Memory'}
                </h3>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="p-1.5 hover:bg-dark-700/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-dark-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Content
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    onPaste={handlePaste}
                    className="w-full px-4 py-3 rounded-xl glass-input outline-none resize-none text-dark-100 text-sm"
                    rows="4"
                    placeholder="What should the AI remember about you?"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl glass-input outline-none text-dark-100 bg-dark-800 text-sm"
                    >
                      <option value="general">General</option>
                      <option value="personal">Personal</option>
                      <option value="work">Work</option>
                      <option value="preferences">Preferences</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Importance: {formData.importance}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={formData.importance}
                      onChange={(e) => setFormData({ ...formData, importance: parseInt(e.target.value) })}
                      className="w-full mt-2"
                    />
                    <div className="flex justify-between text-xs text-dark-500 mt-1">
                      <span>Low</span>
                      <span>High</span>
                    </div>
                  </div>
                </div>

                {/* Image Upload Section */}
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Images ({totalImages}/10)
                  </label>
                  
                  {/* Image Preview Grid */}
                  {(existingImages.length > 0 || pendingImages.length > 0) && (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 mb-3">
                      {existingImages.map(image => (
                        <div
                          key={image.id}
                          className="relative group aspect-square rounded-lg overflow-hidden border border-dark-600/50 bg-dark-700/50"
                        >
                          <img
                            src={getImageUrl(image)}
                            alt={image.original_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div className="hidden absolute inset-0 items-center justify-center bg-dark-800">
                            <ImageIcon className="w-6 h-6 text-dark-500" />
                          </div>
                          <div className="absolute inset-0 bg-dark-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedImage(getImageUrl(image))}
                              className="p-1.5 bg-dark-700/80 rounded-lg hover:bg-dark-600 transition-colors"
                            >
                              <ZoomIn className="w-3.5 h-3.5 text-dark-200" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeExistingImage(image.id)}
                              className="p-1.5 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-colors"
                            >
                              <X className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-dark-900/80 px-1.5 py-0.5">
                            <p className="text-[8px] text-dark-400 truncate">{image.original_name}</p>
                          </div>
                        </div>
                      ))}
                      
                      {pendingImages.map(image => (
                        <div
                          key={image.id}
                          className="relative group aspect-square rounded-lg overflow-hidden border border-accent/30 bg-dark-700/50"
                        >
                          <img
                            src={image.preview}
                            alt={image.original_name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-dark-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => removePendingImage(image.id)}
                              className="p-1.5 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition-colors"
                            >
                              <X className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-accent/20 px-1.5 py-0.5">
                            <p className="text-[8px] text-accent truncate">{formatFileSize(image.size)}</p>
                          </div>
                          <div className="absolute top-1 right-1">
                            <span className="text-[8px] bg-accent/30 text-accent px-1 rounded">NEW</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Area */}
                  {canAddMore && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      className={`
                        relative border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all duration-200
                        ${isDragging 
                          ? 'border-accent bg-accent/5' 
                          : 'border-dark-600 hover:border-dark-500 hover:bg-dark-800/30'
                        }
                      `}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <div className="flex flex-col items-center gap-2">
                        <Upload className={`w-8 h-8 ${isDragging ? 'text-accent' : 'text-dark-500'}`} />
                        <div className="text-center">
                          <p className="text-sm text-dark-300">
                            Drop images here or click to upload
                          </p>
                          <p className="text-xs text-dark-500 mt-1">
                            Supports: JPG, PNG, GIF, WebP (max 10MB each)
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !formData.content.trim()}
                  className="btn-primary w-full py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingId ? 'Update Memory' : 'Save Memory'}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Memories List */}
          <div className="space-y-4">
            {memories.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-dark-800 flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-8 h-8 text-dark-500" />
                </div>
                <p className="text-dark-400">No memories yet. Add your first memory to help the AI remember important context.</p>
              </div>
            ) : (
              memories.map(memory => (
                <div
                  key={memory.id}
                  className="p-5 bg-dark-800/50 border border-dark-700/50 rounded-xl hover:border-dark-600 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getCategoryColor(memory.category)}`}>
                          {memory.category}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${i < memory.importance
                                  ? 'text-accent fill-accent'
                                  : 'text-dark-600'
                                }`}
                            />
                          ))}
                        </div>
                        {memory.images && memory.images.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-dark-500 ml-2">
                            <ImageIcon className="w-3 h-3" />
                            {memory.images.length}
                          </span>
                        )}
                      </div>
                      <p className="text-dark-200 whitespace-pre-wrap text-sm">{memory.content}</p>
                      
                      {/* Image Thumbnails */}
                      {memory.images && memory.images.length > 0 && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {memory.images.map(image => (
                            <button
                              key={image.id}
                              onClick={() => setSelectedImage(getImageUrl(image))}
                              className="relative w-16 h-16 rounded-lg overflow-hidden border border-dark-600/50 hover:border-accent/50 transition-colors group"
                            >
                              <img
                                src={getImageUrl(image)}
                                alt={image.original_name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-dark-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="w-4 h-4 text-white" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      <p className="text-xs text-dark-500 mt-2">
                        Created {new Date(memory.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(memory)}
                        className="p-2 hover:bg-accent/10 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-accent" />
                      </button>
                      <button
                        onClick={() => handleDelete(memory.id)}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Image Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/95 backdrop-blur-sm p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 bg-dark-800/50 rounded-full hover:bg-dark-700 transition-colors"
          >
            <X className="w-6 h-6 text-dark-300" />
          </button>
          <img
            src={selectedImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default Memories;
