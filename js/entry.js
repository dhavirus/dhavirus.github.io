import { requireSession, signOut } from "./auth.js";
import { supabase } from "./supabaseClient.js";
import { todayISODate } from "./dateUtils.js";
import { uploadImage, getSignedUrl, deleteImages, rehydrateImages, extractImagePaths } from "./storage.js";

const session = await requireSession();
if (!session) throw new Error("redirecting to login");

document.getElementById("sign-out").addEventListener("click", (e) => {
  e.preventDefault();
  signOut();
});

const params = new URLSearchParams(window.location.search);
const entryId = params.get("id");
const datePreset = params.get("date");

const titleInput = document.getElementById("entry-title");
const dateInput = document.getElementById("entry-date");
const fontSelect = document.getElementById("entry-font");
const pinnedInput = document.getElementById("entry-pinned");
const contentEl = document.getElementById("entry-content");
const statusEl = document.getElementById("status");
const deleteBtn = document.getElementById("delete-entry-btn");

dateInput.value = datePreset || todayISODate();

let currentThumbnailPath = null; // storage path, or null if no thumbnail

function applyFontClass() {
  contentEl.className = `entry-content entry-font-${fontSelect.value}`;
}
fontSelect.addEventListener("change", applyFontClass);
applyFontClass();

function highlightCodeBlocks() {
  contentEl.querySelectorAll("pre code").forEach((block) => window.hljs?.highlightElement(block));
}

// --- Thumbnail ---

const thumbnailUpload = document.getElementById("thumbnail-upload");
const thumbnailPreview = document.getElementById("thumbnail-preview");
const thumbnailPlaceholder = document.getElementById("thumbnail-placeholder");
const thumbnailInput = document.getElementById("thumbnail-input");

function showThumbnail(url) {
  thumbnailPreview.src = url;
  thumbnailPreview.hidden = false;
  thumbnailPlaceholder.hidden = true;
}

thumbnailUpload.addEventListener("click", () => thumbnailInput.click());

thumbnailInput.addEventListener("change", async () => {
  const file = thumbnailInput.files[0];
  if (!file) return;

  const previousPath = currentThumbnailPath;
  statusEl.textContent = "Uploading thumbnail...";
  const { path, error } = await uploadImage(session.user.id, file);
  if (error) {
    statusEl.textContent = "Could not upload thumbnail.";
    return;
  }

  currentThumbnailPath = path;
  showThumbnail(await getSignedUrl(path));
  statusEl.textContent = "";

  // Replacing a thumbnail uploaded earlier in this same session — clean up
  // the one nobody will ever reference now.
  if (previousPath) await deleteImages([previousPath]);
});

// --- Toolbar: bold/italic (native execCommand, no selection-range engine
// needed for two simple inline commands) ---

document.querySelectorAll(".editor-toolbar [data-cmd]").forEach((btn) => {
  btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep selection alive
  btn.addEventListener("click", () => document.execCommand(btn.dataset.cmd));
});

// --- Insert image into content ---

let savedRange = null;
function saveSelection() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0 && contentEl.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0);
}
function restoreSelection() {
  if (!savedRange) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedRange);
}

contentEl.addEventListener("keyup", saveSelection);
contentEl.addEventListener("mouseup", saveSelection);

const contentImageInput = document.getElementById("content-image-input");

document.getElementById("insert-image-btn").addEventListener("click", () => {
  saveSelection();
  contentImageInput.click();
});

contentImageInput.addEventListener("change", async () => {
  const file = contentImageInput.files[0];
  if (!file) return;

  statusEl.textContent = "Uploading image...";
  const { path, error } = await uploadImage(session.user.id, file);
  if (error) {
    statusEl.textContent = "Could not upload image.";
    return;
  }
  const url = await getSignedUrl(path);

  contentEl.focus();
  restoreSelection();
  document.execCommand(
    "insertHTML",
    false,
    `<img src="${url}" data-path="${path}" style="max-width:100%; border-radius:8px;" alt="" />`
  );
  contentImageInput.value = "";
  statusEl.textContent = "";
});

// --- Insert code block ---

document.getElementById("insert-code-btn").addEventListener("click", () => {
  const lang = prompt("Language (e.g. javascript, python, bash, plaintext):", "plaintext") || "plaintext";
  contentEl.focus();
  restoreSelection();
  document.execCommand(
    "insertHTML",
    false,
    `<pre><code class="language-${lang}">// type your code here</code></pre><p><br></p>`
  );
});

// --- Load existing entry ---

async function loadEntry() {
  if (!entryId) return;

  const { data: entry } = await supabase.from("diary_entries").select("*").eq("id", entryId).maybeSingle();
  if (!entry) return;

  titleInput.value = entry.title;
  dateInput.value = entry.entry_date;
  fontSelect.value = entry.font;
  pinnedInput.checked = entry.pinned;
  contentEl.innerHTML = entry.content || "";
  applyFontClass();
  highlightCodeBlocks();
  await rehydrateImages(contentEl);

  if (entry.thumbnail_path) {
    currentThumbnailPath = entry.thumbnail_path;
    showThumbnail(await getSignedUrl(entry.thumbnail_path));
  }

  deleteBtn.hidden = false;
}

// --- Save / delete ---

document.getElementById("save-entry-btn").addEventListener("click", async () => {
  if (!titleInput.value.trim()) {
    statusEl.textContent = "Give this entry a title first.";
    return;
  }

  const payload = {
    entry_date: dateInput.value,
    title: titleInput.value.trim(),
    content: contentEl.innerHTML,
    pinned: pinnedInput.checked,
    font: fontSelect.value,
    thumbnail_path: currentThumbnailPath,
  };

  statusEl.textContent = "Saving...";
  const { error } = entryId
    ? await supabase.from("diary_entries").update(payload).eq("id", entryId)
    : await supabase.from("diary_entries").insert(payload);

  if (error) {
    statusEl.textContent = "Something went wrong.";
    return;
  }
  window.location.href = "diary.html";
});

deleteBtn.addEventListener("click", async () => {
  if (!confirm("Delete this entry? This can't be undone.")) return;

  const { data: entry } = await supabase.from("diary_entries").select("content, thumbnail_path").eq("id", entryId).maybeSingle();
  const paths = [...extractImagePaths(entry?.content), entry?.thumbnail_path].filter(Boolean);

  await supabase.from("diary_entries").delete().eq("id", entryId);
  await deleteImages(paths);
  window.location.href = "diary.html";
});

await loadEntry();
