import React, { useRef } from 'react';
import { naturalSortFiles } from '../utils/filenameParser';

export default function ImageUploader({
  images,
  onAddImages,
  onClearAllImages,
  onRemoveImage,
  audioDuration,
}) {
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const processFiles = (fileList) => {
    const rawFiles = Array.from(fileList || []).filter((f) =>
      f.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(f.name)
    );
    if (rawFiles.length === 0) return;

    // Apply natural numerical sorting (img1, img2, ..., img10)
    const sorted = naturalSortFiles(rawFiles);

    const newImages = sorted.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
    }));

    onAddImages(newImages);
  };

  const totalSizeMb = (
    images.reduce((acc, img) => acc + (img.size || 0), 0) / (1024 * 1024)
  ).toFixed(2);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span className="step-pill">2</span>
          <span>Bulk Visual Images ({images.length})</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {images.length > 0 && (
            <>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontFamily: 'JetBrains Mono',
                }}
              >
                {totalSizeMb} MB
              </span>
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--accent-rose)' }}
                onClick={onClearAllImages}
                title="Clear all uploaded images"
              >
                Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bulk Dropzone */}
      <div
        className="dropzone"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) {
            processFiles(e.dataTransfer.files);
          }
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => processFiles(e.target.files)}
        />
        {/* Hidden folder input */}
        <input
          type="file"
          ref={folderInputRef}
          webkitdirectory="true"
          directory="true"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => processFiles(e.target.files)}
        />

        <div className="dropzone-icon">📁</div>
        <div className="dropzone-text">
          Drop all images here or click to select bulk files
        </div>
        <div className="dropzone-subtext">
          Supports PNG, JPG, JPEG, WEBP (Select 10, 50, 100+ images at once)
        </div>

        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '6px 14px', fontSize: '12px' }}
            onClick={(e) => {
              e.stopPropagation();
              folderInputRef.current?.click();
            }}
          >
            📂 Upload Entire Image Folder
          </button>
        </div>
      </div>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="image-preview-grid">
          {images.map((img, idx) => (
            <div key={`${img.name}-${idx}`} className="image-thumb-card">
              <span className="image-thumb-index">#{idx + 1}</span>
              <img src={img.previewUrl} alt={img.name} loading="lazy" />
              <div className="image-thumb-info">
                <div className="image-thumb-name" title={img.name}>
                  {img.name}
                </div>
              </div>
              <button
                className="btn-thumb-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveImage(idx);
                }}
                title="Remove image"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
