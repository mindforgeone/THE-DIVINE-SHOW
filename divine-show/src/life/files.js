import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';
import { createId } from '../marathon/model';

export async function uploadLifeImage(uid, area, file) {
  if (!uid || !storage || !file?.type?.startsWith('image/')) throw new Error('invalid-image');
  if (file.size > 8 * 1024 * 1024) throw new Error('image-too-large');
  const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  const objectRef = ref(storage, `users/${uid}/${area}/${createId('image')}.${extension}`);
  await uploadBytes(objectRef, file, { contentType: file.type });
  return getDownloadURL(objectRef);
}

export function compressImageDataUrl(file, maxDimension = 960, quality = 0.72) {
  if (!file?.type?.startsWith('image/')) return Promise.reject(new Error('invalid-image'));
  if (file.size > 12 * 1024 * 1024) return Promise.reject(new Error('image-too-large'));
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) { URL.revokeObjectURL(url); reject(new Error('image-canvas')); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('invalid-image')); };
    image.src = url;
  });
}
