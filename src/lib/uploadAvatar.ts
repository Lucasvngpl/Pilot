// Legacy subpath: in expo-file-system 56, the top-level export is the new
// File/Directory API; readAsStringAsync + EncodingType live under /legacy.
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
};

export type PickedAsset = {
  uri: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
};

/**
 * Upload a picked image to `avatars/{userId}/avatar.{ext}` and return a
 * cache-busted public URL to store in `profiles.avatar_url`.
 *
 * - Validates client-side and THROWS a human message on bad input (don't fail
 *   silently — the caller surfaces it).
 * - Blob is unreliable in Hermes, so we read base64 → ArrayBuffer.
 * - `upsert` keeps ONE file per user. If the prior avatar had a different ext,
 *   the stale object is removed (no orphans).
 * - The public URL is identical after upsert, so we append `?t=` to force every
 *   screen (expo-image) to fetch the new bytes instead of its cache.
 */
export async function uploadAvatar(
  userId: string,
  asset: PickedAsset,
  prevAvatarUrl?: string | null,
): Promise<string> {
  const mime = asset.mimeType ?? 'image/jpeg';
  if (!EXT[mime]) {
    throw new Error('Please pick a JPEG, PNG, HEIC, or WebP image.');
  }
  if (asset.fileSize != null && asset.fileSize > MAX_BYTES) {
    throw new Error('That image is too large — keep it under 10MB.');
  }
  if (asset.width != null && asset.width < 64) {
    throw new Error('That image is too small for an avatar.');
  }

  const path = `${userId}/avatar.${EXT[mime]}`;

  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = decode(base64);

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw error;

  // No orphans: drop the previous file if it was a different object.
  const prevPath = pathFromPublicUrl(prevAvatarUrl);
  if (prevPath && prevPath !== path) {
    await supabase.storage.from('avatars').remove([prevPath]).catch(() => {});
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

// "{userId}/avatar.png" from a public URL, ignoring any ?t= cache-buster.
function pathFromPublicUrl(url?: string | null): string | null {
  if (!url) return null;
  const marker = '/storage/v1/object/public/avatars/';
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length).split('?')[0];
}
