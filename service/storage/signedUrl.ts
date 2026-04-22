import type { SupabaseClient } from "@supabase/supabase-js";
import { SIGNED_URL_EXPIRY, BUCKET_MAP } from "../../config/constants.js";

const getBucket = (path: string): string | null => {
  for (const [prefix, bucket] of Object.entries(BUCKET_MAP)) {
    if (path.startsWith(prefix)) return bucket;
  }
  return null;
};

export const signImageUrl = async (
  supabaseClient: SupabaseClient,
  imageUrl: string | null,
): Promise<string | null> => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http")) return imageUrl; // already public URL

  const bucket = getBucket(imageUrl);
  if (!bucket) return imageUrl;

  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .createSignedUrl(imageUrl, SIGNED_URL_EXPIRY);

  if (error) {
    console.error(`[signImageUrl] Failed to sign ${imageUrl}:`, error.message);
    return null;
  }

  return data.signedUrl;
};

export const signImageUrls = async (
  supabaseClient: SupabaseClient,
  rows: any[],
  field: string = "image_url",
): Promise<any[]> => {
  const toSign = rows.filter((r) => r[field] && !r[field].startsWith("http"));

  if (toSign.length === 0) return rows;

  // Batch sign by bucket
  const byBucket = new Map<string, { row: any; path: string }[]>();
  for (const row of toSign) {
    const bucket = getBucket(row[field]);
    if (!bucket) continue;
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket)!.push({ row, path: row[field] });
  }

  for (const [bucket, entries] of byBucket) {
    const paths = entries.map((e) => e.path);
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .createSignedUrls(paths, SIGNED_URL_EXPIRY);

    if (error || !data) {
      console.error(`[signImageUrls] Batch sign failed for ${bucket}:`, error?.message);
      continue;
    }

    for (let i = 0; i < entries.length; i++) {
      entries[i]!.row[field] = data[i]?.signedUrl ?? entries[i]!.row[field];
    }
  }

  return rows;
};
