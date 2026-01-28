// Global variables
let selectedImage = null;
let selectedImageBase64 = null;

// API Configuration - menggunakan backend API
const API_BASE_URL = window.location.origin; // Otomatis menggunakan URL server yang sama

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    // Click to upload
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
});

function openCamera() {
    const fileInput = document.getElementById('fileInput');
    // Pada mobile, ini akan membuka camera langsung
    fileInput.setAttribute('capture', 'environment');
    fileInput.setAttribute('accept', 'image/*');
    fileInput.click();
}

function openGallery() {
    const fileInput = document.getElementById('fileInput');
    fileInput.removeAttribute('capture');
    fileInput.click();
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    // Validate file type
    if (!file.type.match('image.*')) {
        showError('Please select an image file (JPG, PNG, JPEG)');
        return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showError('File size too large. Maximum 10MB allowed.');
        return;
    }

    selectedImage = file;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        const imagePreview = document.getElementById('imagePreview');
        imagePreview.src = e.target.result;
        
        // Convert to base64 (remove data URL prefix)
        selectedImageBase64 = e.target.result.split(',')[1];
        
        // Show preview container
        document.getElementById('previewContainer').classList.add('active');
        document.getElementById('uploadArea').style.display = 'none';
        document.querySelector('.camera-buttons').style.display = 'none';
        
        // Hide error if any
        hideError();
    };
    reader.readAsDataURL(file);
}

function resetUpload() {
    selectedImage = null;
    selectedImageBase64 = null;
    
    document.getElementById('fileInput').value = '';
    document.getElementById('previewContainer').classList.remove('active');
    document.getElementById('resultContainer').classList.remove('active');
    document.getElementById('uploadArea').style.display = 'block';
    document.querySelector('.camera-buttons').style.display = 'grid';
    
    hideError();
    hideLoading();
}

async function analyzeImage() {
    if (!selectedImageBase64) {
        showError('Please select an image first');
        return;
    }

    // Show loading
    showLoading();
    hideError();
    
    // Disable analyze button
    const analyzeBtn = document.getElementById('analyzeBtn');
    analyzeBtn.disabled = true;

    try {
        // Request ke backend API
        const response = await fetch(`${API_BASE_URL}/api/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imageBase64: selectedImageBase64
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to analyze image');
        }

        if (!data.success || !data.result) {
            throw new Error('No response from AI');
        }

        // Clean result from markdown formatting
        const cleanResult = cleanText(data.result);
        
        // Show result
        displayResult(cleanResult);
        
    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'Failed to analyze image. Please try again.');
    } finally {
        hideLoading();
        analyzeBtn.disabled = false;
    }
}

function displayResult(result) {
    const resultContent = document.getElementById('resultContent');
    resultContent.textContent = result;
    
    document.getElementById('resultContainer').classList.add('active');
    document.getElementById('previewContainer').classList.remove('active');
}

function cleanText(text) {
    return text
        .replace(/^#{1,6}\s+/gm, '')  // Remove headers
        .replace(/\*\*/g, '')          // Remove bold markers
        .replace(/`/g, '')             // Remove backticks
        .replace(/\n{3,}/g, '\n\n')   // Max 2 newlines
        .trim();
}

function showLoading() {
    document.getElementById('loading').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading').classList.remove('active');
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.classList.add('active');
}

function hideError() {
    document.getElementById('errorMessage').classList.remove('active');
}

// Handle image compression for large files
function compressImage(file, maxWidth = 1200) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = height * (maxWidth / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(resolve, 'image/jpeg', 0.85);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}