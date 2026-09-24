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
