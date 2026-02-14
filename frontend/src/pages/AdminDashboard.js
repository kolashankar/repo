import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { X, Upload, Trash2, Image as ImageIcon, Loader2, Music } from 'lucide-react';
import { retryApiCall } from '@/utils/apiRetry';
import { useMobile } from '@/hooks/useMobile';
import { GridSkeleton, PhotoSkeleton } from '@/components/LoadingSkeleton';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// File Upload Component with Drag & Drop
function FileUploadZone({ onFilesSelected, label, accept = "image/*" }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    onFilesSelected(files);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    onFilesSelected(files);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-pink-500 bg-pink-50'
            : 'border-gray-300 hover:border-pink-400 hover:bg-gray-50'
        }`}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-semibold text-pink-600">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-gray-500">PNG ONLY (max 10MB)</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}

// Photo Preview Component
function PhotoPreview({ photo, onDelete, uploading = false, progress = 0 }) {
  return (
    <div className="relative group">
      <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100">
        {uploading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Progress value={progress} className="w-20 mb-2" />
            <p className="text-xs text-gray-500">{progress}%</p>
          </div>
        ) : (
          <>
            <img
              src={photo.file_url}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            <button
              onClick={onDelete}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('list');
  const [editingCategory, setEditingCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isMobile } = useMobile();
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sentences: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Photo upload state
  const [uploadingPhotos, setUploadingPhotos] = useState([]);

  // Music Settings State
  const [musicSettings, setMusicSettings] = useState({
    before_accept_music: '',
    after_accept_music: ''
  });
  const [musicLoading, setMusicLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await retryApiCall(async () => {
        return await axios.get(`${API}/admin/categories`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }, 2, 1000);
      
      setCategories(res.data);
      toast.success(`Loaded ${res.data.length} categories`);
    } catch (e) {
      console.error('Fetch error:', e);
      if (e.response?.status === 401) {
        setToken(null);
        localStorage.removeItem('admin_token');
        toast.error('Session expired. Please login again.');
      } else {
        toast.error('Failed to load categories');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchMusicSettings = useCallback(async () => {
    try {
      const res = await retryApiCall(async () => {
        return await axios.get(`${API}/admin/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }, 2, 1000);
      
      setMusicSettings({
        before_accept_music: res.data.before_accept_music || '',
        after_accept_music: res.data.after_accept_music || ''
      });
    } catch (e) {
      console.error('Failed to fetch music settings:', e);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchCategories();
      fetchMusicSettings();
    }
  }, [token, fetchCategories, fetchMusicSettings]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    
    try {
      const res = await retryApiCall(async () => {
        return await axios.post(`${API}/auth/login`, { email, password });
      }, 2, 1000);
      
      const t = res.data.access_token;
      setToken(t);
      localStorage.setItem('admin_token', t);
      toast.success('Login successful! Welcome back 🎉');
    } catch (e) {
      console.error('Login error:', e);
      if (e.response?.status === 401 || e.response?.status === 400) {
        toast.error('Invalid credentials. Please try again.');
      } else {
        toast.error('Login failed. Please check your connection.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSaveMusicSettings = async (e) => {
    e.preventDefault();
    setMusicLoading(true);

    try {
      const res = await retryApiCall(async () => {
        return await axios.put(
          `${API}/admin/settings`,
          musicSettings,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }, 2, 1000);

      toast.success('Music settings saved successfully! 🎵');
      setMusicSettings({
        before_accept_music: res.data.before_accept_music || '',
        after_accept_music: res.data.after_accept_music || ''
      });
    } catch (e) {
      console.error('Save music settings error:', e);
      toast.error('Failed to save music settings');
    } finally {
      setMusicLoading(false);
    }
  };

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    
    // Validate form
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!formData.sentences.trim()) {
      errors.sentences = 'At least one sentence is required';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error('Please fix form errors');
      return;
    }
    
    setFormErrors({});
    
    const payload = {
      name: formData.name.trim(),
      sentences: formData.sentences.split('\n').filter(s => s.trim())
    };

    const loadingToast = toast.loading(editingCategory ? 'Updating category...' : 'Creating category...');
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      let categoryId;

      if (editingCategory) {
        // Update existing
        await retryApiCall(async () => {
          return await axios.put(`${API}/admin/categories/${editingCategory.id}`, payload, { headers });
        }, 2, 1000);
        categoryId = editingCategory.id;
        toast.success('Category updated successfully! ✨', { id: loadingToast });
      } else {
        // Create new
        const res = await retryApiCall(async () => {
          return await axios.post(`${API}/admin/categories`, payload, { headers });
        }, 2, 1000);
        categoryId = res.data.id;
        toast.success('Category created! Now upload photos 📸', { id: loadingToast });
      }

      // Refresh and switch to edit mode to allow photo uploads
      await fetchCategories();
      const updatedCategory = categories.find(c => c.id === categoryId) || 
                             (await axios.get(`${API}/admin/categories/${categoryId}`, { headers })).data;
      
      setEditingCategory(updatedCategory);
      setActiveTab('edit');
    } catch (e) {
      console.error('Save error:', e);
      toast.error('Error saving category: ' + (e.response?.data?.detail || e.message), { id: loadingToast });
    }
  };

  const handleFilesSelected = async (files, photoType) => {
    if (!editingCategory) {
      toast.error('Please save the category first before uploading photos');
      return;
    }

    // Validate files
    const validFiles = [];
    for (let file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }
      // Strict PNG validation
      if (file.type !== 'image/png') {
        toast.error(`${file.name} must be a PNG image`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    const headers = { Authorization: `Bearer ${token}` };
    
    for (let file of validFiles) {
      const uploadId = Date.now() + Math.random();
      
      // Add to uploading list
      setUploadingPhotos(prev => [...prev, { id: uploadId, name: file.name, progress: 0 }]);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const endpoint = photoType === 'before' 
          ? `${API}/admin/categories/${editingCategory.id}/upload-photo-before`
          : `${API}/admin/categories/${editingCategory.id}/upload-photo-after`;

        const res = await retryApiCall(async () => {
          return await axios.post(endpoint, formData, {
            headers: {
              ...headers,
              'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadingPhotos(prev =>
                prev.map(p => p.id === uploadId ? { ...p, progress } : p)
              );
            }
          });
        }, 2, 1000);

        // Remove from uploading list
        setUploadingPhotos(prev => prev.filter(p => p.id !== uploadId));

        // Refresh category to show new photo
        const updatedCategory = await axios.get(`${API}/admin/categories/${editingCategory.id}`, { headers });
        setEditingCategory(updatedCategory.data);
        await fetchCategories();
        
        toast.success(`${file.name} uploaded successfully! ✅`);

      } catch (e) {
        console.error('Upload error:', e);
        setUploadingPhotos(prev => prev.filter(p => p.id !== uploadId));
        toast.error(`Failed to upload ${file.name}: ${e.response?.data?.detail || e.message}`);
      }
    }
  };

  const handleDeletePhoto = async (photoId, photoType) => {
    if (!window.confirm('Delete this photo?')) return;

    const loadingToast = toast.loading('Deleting photo...');

    try {
      const headers = { Authorization: `Bearer ${token}` };
      await retryApiCall(async () => {
        return await axios.delete(
          `${API}/admin/categories/${editingCategory.id}/photos/${photoId}?photo_type=${photoType}`,
          { headers }
        );
      }, 2, 1000);

      // Refresh category
      const updatedCategory = await axios.get(`${API}/admin/categories/${editingCategory.id}`, { headers });
      setEditingCategory(updatedCategory.data);
      await fetchCategories();
      
      toast.success('Photo deleted successfully', { id: loadingToast });
    } catch (e) {
      console.error('Delete error:', e);
      toast.error('Failed to delete photo: ' + (e.response?.data?.detail || e.message), { id: loadingToast });
    }
  };

  const handleEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      sentences: cat.sentences?.join('\n') || ''
    });
    setActiveTab('edit');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category? All photos will be lost.')) return;
    
    const loadingToast = toast.loading('Deleting category...');
    
    try {
      await retryApiCall(async () => {
        return await axios.delete(`${API}/admin/categories/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }, 2, 1000);
      
      await fetchCategories();
      toast.success('Category deleted successfully', { id: loadingToast });
    } catch (e) {
      console.error('Delete error:', e);
      toast.error('Failed to delete category', { id: loadingToast });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', sentences: '' });
    setEditingCategory(null);
    setUploadingPhotos([]);
  };

  // ========== LOGIN VIEW ==========
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl text-center text-pink-600">Admin Login</CardTitle>
            <CardDescription className="text-center text-sm md:text-base">Romantic Proposal Admin Panel</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  placeholder="admin@example.com"
                  data-testid="email-input"
                  required
                  disabled={loginLoading}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  type="password"
                  data-testid="password-input"
                  required
                  disabled={loginLoading}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-pink-500 to-purple-500"
                disabled={loginLoading}
                data-testid="login-btn"
              >
                {loginLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ========== MAIN DASHBOARD ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 p-3 md:p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-pink-600">Proposal Admin</h1>
            <p className="text-gray-600 text-sm md:text-base">Manage categories, photos & music</p>
          </div>
          <Button
            variant="outline"
            size={isMobile ? "sm" : "default"}
            onClick={() => {
              setToken(null);
              localStorage.removeItem('admin_token');
              toast.success('Logged out successfully');
            }}
          >
            Logout
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 md:gap-4 mb-6">
          <Button
            variant={activeTab === 'list' ? 'default' : 'outline'}
            size={isMobile ? "sm" : "default"}
            onClick={() => {
              setActiveTab('list');
              resetForm();
            }}
            className={activeTab === 'list' ? 'bg-pink-500' : ''}
          >
            All Categories ({categories.length})
          </Button>
          <Button
            variant={activeTab === 'create' ? 'default' : 'outline'}
            size={isMobile ? "sm" : "default"}
            onClick={() => {
              setActiveTab('create');
              resetForm();
            }}
            className={activeTab === 'create' ? 'bg-pink-500' : ''}
          >
            Create New
          </Button>
          <Button
            variant={activeTab === 'music' ? 'default' : 'outline'}
            size={isMobile ? "sm" : "default"}
            onClick={() => setActiveTab('music')}
            className={activeTab === 'music' ? 'bg-pink-500' : ''}
          >
            <Music className="w-4 h-4 mr-2" />
            Music Settings
          </Button>
        </div>

        {/* ========== MUSIC SETTINGS VIEW ========== */}
        {activeTab === 'music' && (
          <Card>
            <CardHeader>
              <CardTitle>🎵 Global Music Settings</CardTitle>
              <CardDescription>
                Configure YouTube URLs for background music. These will apply to all categories.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveMusicSettings} className="space-y-6">
                <div className="space-y-2">
                  <Label>Music (Before Accept) - YouTube URL</Label>
                  <Input
                    value={musicSettings.before_accept_music}
                    onChange={e => setMusicSettings({ ...musicSettings, before_accept_music: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                    type="url"
                  />
                  <p className="text-xs text-gray-500">
                    This music plays on the proposal screen before user accepts
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Music (After Accept) - YouTube URL</Label>
                  <Input
                    value={musicSettings.after_accept_music}
                    onChange={e => setMusicSettings({ ...musicSettings, after_accept_music: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                    type="url"
                  />
                  <p className="text-xs text-gray-500">
                    This music plays on the 3D photo gallery after user accepts
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-500"
                  disabled={musicLoading}
                >
                  {musicLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Music Settings'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ========== LIST VIEW ========== */}
        {activeTab === 'list' && (
          <>
            {loading ? (
              <GridSkeleton count={6} />
            ) : (
              <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {categories.map(cat => (
                  <Card key={cat.id} className="hover:shadow-lg transition-shadow" data-testid="category-card">
                    <CardHeader>
                      <CardTitle className="text-lg md:text-xl">{cat.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2 text-sm text-gray-600">
                        <p>📸 Before Photos: {cat.photos_before?.length || 0}</p>
                        <p>🎨 After Photos: {cat.photos_after?.length || 0}</p>
                        <p>💬 Sentences: {cat.sentences?.length || 0}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleEdit(cat)} className="bg-blue-500 flex-1">
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(cat.id)} className="flex-1">
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {categories.length === 0 && !loading && (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    <ImageIcon className="w-12 md:w-16 h-12 md:h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-sm md:text-base">No categories yet. Create your first one!</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ========== CREATE/EDIT VIEW ========== */}
        {(activeTab === 'create' || activeTab === 'edit') && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingCategory ? `Edit: ${editingCategory.name}` : 'Create New Category'}
                </CardTitle>
                <CardDescription>
                  {editingCategory
                    ? 'Update category details and manage photos'
                    : 'First create the category, then upload photos'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateOrUpdate} className="space-y-6">
                  {/* Basic Info */}
                  <div className="space-y-2">
                    <Label>Category Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={e => {
                        setFormData({ ...formData, name: e.target.value });
                        if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                      }}
                      placeholder="Romantic Sunset, Dream Wedding, etc."
                      data-testid="category-name-input"
                      required
                      className={formErrors.name ? 'border-red-500' : ''}
                    />
                    {formErrors.name && (
                      <p className="text-sm text-red-500">{formErrors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Romantic Sentences (One per line) *</Label>
                    <Textarea
                      value={formData.sentences}
                      onChange={e => {
                        setFormData({ ...formData, sentences: e.target.value });
                        if (formErrors.sentences) setFormErrors({ ...formErrors, sentences: '' });
                      }}
                      rows={6}
                      placeholder="Will you marry me? ❤️&#10;You are my everything ✨&#10;Let's grow old together 💍"
                      data-testid="sentences-textarea"
                      required
                      className={formErrors.sentences ? 'border-red-500 text-sm' : 'text-sm'}
                    />
                    {formErrors.sentences ? (
                      <p className="text-sm text-red-500">{formErrors.sentences}</p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        {formData.sentences.split('\n').filter(s => s.trim()).length} sentences
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-base md:text-lg py-5 md:py-6"
                    data-testid="save-category-btn"
                  >
                    {editingCategory ? 'Update Category Info' : 'Create Category'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Photo Upload Sections - Only show after category is created */}
            {editingCategory && (
              <>
                {/* Photos Before Accept */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      📸 Photos (Before Accept)
                      <span className="text-sm font-normal text-gray-500">
                        - Shown with romantic sentences
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FileUploadZone
                      label="Upload Photos for Proposal Screen"
                      onFilesSelected={(files) => handleFilesSelected(files, 'before')}
                    />

                    {/* Uploaded Photos */}
                    <div className="flex flex-wrap gap-4">
                      {uploadingPhotos.map(upload => (
                        <PhotoPreview
                          key={upload.id}
                          photo={{ file_url: '' }}
                          uploading={true}
                          progress={upload.progress}
                        />
                      ))}
                      {editingCategory.photos_before?.map(photo => (
                        <PhotoPreview
                          key={photo.id}
                          photo={photo}
                          onDelete={() => handleDeletePhoto(photo.id, 'before')}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-gray-600">
                      {editingCategory.photos_before?.length || 0} photo(s) uploaded
                    </p>
                  </CardContent>
                </Card>

                {/* Photos After Accept */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      🎨 Photos (After Accept)
                      <span className="text-sm font-normal text-gray-500">
                        - Shown in 3D gallery
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FileUploadZone
                      label="Upload Photos for 3D Gallery"
                      onFilesSelected={(files) => handleFilesSelected(files, 'after')}
                    />

                    {/* Uploaded Photos */}
                    <div className="flex flex-wrap gap-4">
                      {editingCategory.photos_after?.map(photo => (
                        <PhotoPreview
                          key={photo.id}
                          photo={photo}
                          onDelete={() => handleDeletePhoto(photo.id, 'after')}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-gray-600">
                      {editingCategory.photos_after?.length || 0} photo(s) uploaded
                    </p>
                  </CardContent>
                </Card>

                {/* Done Button */}
                <Button
                  onClick={() => {
                    setActiveTab('list');
                    resetForm();
                  }}
                  className="w-full bg-green-500 hover:bg-green-600"
                  size="lg"
                >
                  Done - Back to List
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
