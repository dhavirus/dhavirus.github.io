import { supabase } from "./supabaseClient.js";

const BUCKET = "diary-images";
const SIGNED_URL_TTL = 3600; // seconds

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

// Uploads a file under the user's own folder (required by the storage RLS
// policies) and returns the storage path — never a URL, since signed URLs
// expire and paths don't.
export async function uploadImage(userId, file) {
  const path = `${userId}/${Date.now()}-${sanitizeFilename(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  return { path, error };
}

export async function getSignedUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  return error ? null : data.signedUrl;
}

export async function deleteImages(paths) {
  if (!paths || paths.length === 0) return;
  await supabase.storage.from(BUCKET).remove(paths);
}

// Refreshes every <img data-path="..."> inside containerEl with a fresh
// signed URL — call this whenever previously-saved content is displayed.
export async function rehydrateImages(containerEl) {
  const images = [...containerEl.querySelectorAll("img[data-path]")];
  await Promise.all(
    images.map(async (img) => {
      const url = await getSignedUrl(img.dataset.path);
      if (url) img.src = url;
    })
  );
}

// Extracts every image storage path referenced by a block of saved content
// HTML — used to clean up storage when an entry is deleted.
export function extractImagePaths(contentHtml) {
  if (!contentHtml) return [];
  const div = document.createElement("div");
  div.innerHTML = contentHtml;
  return [...div.querySelectorAll("img[data-path]")].map((img) => img.dataset.path);
}
