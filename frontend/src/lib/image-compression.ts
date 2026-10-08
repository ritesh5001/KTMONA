import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file before upload to meet ImageKit's 25MP free tier limit
 * and generally improve upload/download speeds.
 */
export async function compressImageForUpload(file: File): Promise<File> {
    // Only compress images. Ignore SVGs, PDFs, etc.
    if (!file.type.startsWith('image/')) {
        return file;
    }

    const options = {
        maxSizeMB: 1, // Max 1MB (configurable)
        maxWidthOrHeight: 1920, // Max 1920px dimensions to keep it well under 25MP
        useWebWorker: true,
        fileType: 'image/webp', // Convert to WebP for better compression
    };

    try {
        const compressedBlob = await imageCompression(file, options);
        // Convert blob back to a File object with the original name but .webp extension
        const fileName = file.name.split('.').slice(0, -1).join('.') + '.webp';
        return new File([compressedBlob], fileName, {
            type: 'image/webp',
        });
    } catch (error) {
        console.error('Image compression failed:', error);
        // Fallback to original file if compression fails
        return file;
    }
}
