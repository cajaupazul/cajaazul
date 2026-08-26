import { deleteFileFromR2WithRetry, uploadFileToR2 } from './r2-storage';

export const STORE_ASSET_BUCKET = 'profile-frames';

function extensionForMime(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/gif') return 'gif';
  return 'webp';
}

async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

export type StoreAssetInput = {
  bucket: typeof STORE_ASSET_BUCKET;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
};

export async function uploadStoreItemAsset(itemId: string, version: number, blob: Blob, mimeType: string): Promise<StoreAssetInput> {
  const extension = extensionForMime(mimeType);
  const objectKey = `items/${itemId}/v${version}/original.${extension}`;
  const file = new File([blob], `original.${extension}`, { type: mimeType });
  const checksumSha256 = await sha256(file);
  await uploadFileToR2(STORE_ASSET_BUCKET, objectKey, file);
  return { bucket: STORE_ASSET_BUCKET, objectKey, mimeType, sizeBytes: file.size, checksumSha256 };
}

export async function cleanupStoreItemAsset(asset: StoreAssetInput) {
  await deleteFileFromR2WithRetry(asset.bucket, asset.objectKey);
}
