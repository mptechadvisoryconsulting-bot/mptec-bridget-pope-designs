"use client";

import type { DragEvent, FormEvent } from "react";
import { useRef, useState } from "react";
import Link from "next/link";
import { Eye, GripVertical, Home, ImagePlus, Pencil, RefreshCw, Replace, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublicGalleryItem } from "@/lib/gallery";

type GalleryResponse = {
  success: boolean;
  items?: PublicGalleryItem[];
  message?: string;
};

function formatDate(value?: string) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  } catch {
    return "—";
  }
}

export function AdminGalleryManager({ initialItems }: { initialItems: PublicGalleryItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const replaceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function refreshGallery() {
    const response = await fetch("/api/gallery?admin=1&limit=200");
    const payload = (await response.json()) as GalleryResponse;
    if (payload.success && payload.items) {
      setItems(payload.items);
    }
  }

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/uploads", {
      method: "POST",
      body: form,
    });
    const payload = await response.json();

    if (!response.ok) {
      setStatus(payload.message ?? "Upload failed.");
      setIsSubmitting(false);
      return;
    }

    event.currentTarget.reset();
    await refreshGallery();
    setStatus("Photo added to the gallery library.");
    setIsSubmitting(false);
  }

  async function patchItem(id: string, body: Record<string, unknown>, successMessage?: string) {
    setStatus("");
    const response = await fetch(`/api/gallery/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(payload.message ?? "Unable to update gallery item.");
      return false;
    }
    await refreshGallery();
    if (successMessage) setStatus(successMessage);
    return true;
  }

  async function removePhoto(item: PublicGalleryItem) {
    const confirmed = window.confirm(`Remove “${item.title}” from the gallery library?`);
    if (!confirmed) return;

    setRemovingId(item.id);
    setStatus("");

    const response = await fetch(`/api/files/${item.id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus(payload.message ?? "Unable to remove that photo.");
      setRemovingId(null);
      return;
    }

    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setStatus("Photo removed from the gallery.");
    setRemovingId(null);
  }

  function beginEdit(item: PublicGalleryItem) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditCategory(item.category);
    setEditDescription(item.description ?? "");
  }

  async function saveEdit(item: PublicGalleryItem) {
    const ok = await patchItem(
      item.id,
      {
        title: editTitle,
        category: editCategory,
        description: editDescription || null,
      },
      "Gallery details saved.",
    );
    if (ok) setEditingId(null);
  }

  async function replacePhoto(item: PublicGalleryItem, file: File | null) {
    if (!file) return;
    setStatus("");
    const form = new FormData();
    form.set("file", file);
    const response = await fetch(`/api/gallery/${item.id}/replace`, { method: "POST", body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(payload.message ?? "Unable to replace that photo.");
      return;
    }
    await refreshGallery();
    setStatus(`Replaced image for “${item.title}”.`);
  }

  function onDragStart(id: string) {
    setDragId(id);
  }

  function onDragOver(event: DragEvent, overId: string) {
    event.preventDefault();
    if (!dragId || dragId === overId) return;
    setItems((current) => {
      const from = current.findIndex((item) => item.id === dragId);
      const to = current.findIndex((item) => item.id === overId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function onDragEnd() {
    if (!dragId) return;
    setDragId(null);
    const orderedIds = items.map((item) => item.id);
    const response = await fetch("/api/gallery/reorder", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setStatus(payload.message ?? "Unable to save gallery order.");
      await refreshGallery();
      return;
    }
    setStatus("Gallery order saved.");
  }

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Content</span>
          <h1>Gallery Manager</h1>
          <p className="mini-meta">
            Single source of truth for homepage and /gallery. Toggle homepage visibility separately from the library.
          </p>
        </div>
        <div className="topbar-actions">
          <Link className="btn btn-light" href="/admin/website">
            Website Content
          </Link>
          <Link className="btn btn-light" href="/gallery" target="_blank">
            <Eye size={16} /> Preview gallery
          </Link>
          <button className="icon-btn" aria-label="Refresh gallery" onClick={refreshGallery} type="button">
            <RefreshCw size={17} />
          </button>
        </div>
      </div>

      <div className="gallery-manager">
        <form className="panel gallery-upload" onSubmit={uploadPhoto}>
          <h2>Upload Event Photo</h2>
          <label className="field">
            <span>Title</span>
            <Input name="title" placeholder="Golden Wedding Tablescape" required />
          </label>
          <label className="field">
            <span>Category</span>
            <Input name="category" placeholder="Weddings" required />
          </label>
          <label className="field">
            <span>Description (optional)</span>
            <Input name="description" placeholder="Short caption" />
          </label>
          <label className="field">
            <span>Photo</span>
            <Input accept="image/jpeg,image/png,image/webp" name="file" required type="file" />
          </label>
          <label className="check-row">
            <input name="showOnHomepage" type="checkbox" value="1" />
            <span>Display on Homepage</span>
          </label>
          <label className="check-row">
            <input name="isFeatured" type="checkbox" value="1" />
            <span>Featured Design</span>
          </label>
          {status ? (
            <p className={/fail|unable|required|error/i.test(status) ? "form-error" : "form-success"}>{status}</p>
          ) : null}
          <Button disabled={isSubmitting} type="submit">
            <ImagePlus size={16} /> {isSubmitting ? "Uploading..." : "Add to Gallery"}
          </Button>
        </form>

        <section className="panel span-2" style={{ gridColumn: "1 / -1" }}>
          <h2>Gallery Library</h2>
          <p className="mini-meta">Drag rows to reorder. Homepage only shows items with Homepage Visible on.</p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th aria-label="Reorder" />
                  <th>Thumbnail</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Homepage Visible</th>
                  <th>Date Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    draggable
                    onDragEnd={onDragEnd}
                    onDragOver={(event) => onDragOver(event, item.id)}
                    onDragStart={() => onDragStart(item.id)}
                    style={{ opacity: dragId === item.id ? 0.6 : item.isVisible === false ? 0.55 : 1 }}
                  >
                    <td>
                      <GripVertical aria-hidden size={16} />
                    </td>
                    <td>
                      <img
                        alt=""
                        src={item.image}
                        style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 6 }}
                      />
                    </td>
                    <td>
                      {editingId === item.id ? (
                        <Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                      ) : (
                        <strong>{item.title}</strong>
                      )}
                      {item.isFeatured ? (
                        <div className="mini-meta">
                          <Star size={12} /> Featured
                        </div>
                      ) : null}
                      {item.isVisible === false ? <div className="mini-meta">Hidden from public library</div> : null}
                    </td>
                    <td>
                      {editingId === item.id ? (
                        <Input value={editCategory} onChange={(event) => setEditCategory(event.target.value)} />
                      ) : (
                        item.category
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-light"
                        onClick={() =>
                          patchItem(item.id, { showOnHomepage: !item.showOnHomepage }, "Homepage visibility updated.")
                        }
                        type="button"
                      >
                        <Home size={14} /> {item.showOnHomepage ? "On" : "Off"}
                      </button>
                    </td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <div className="topbar-actions compact">
                        {editingId === item.id ? (
                          <>
                            <Input
                              placeholder="Description"
                              value={editDescription}
                              onChange={(event) => setEditDescription(event.target.value)}
                            />
                            <Button onClick={() => saveEdit(item)} type="button" variant="light">
                              Save
                            </Button>
                            <Button onClick={() => setEditingId(null)} type="button" variant="light">
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button onClick={() => beginEdit(item)} type="button" variant="light">
                              <Pencil size={14} /> Edit
                            </Button>
                            <Button
                              onClick={() => replaceInputRefs.current[item.id]?.click()}
                              type="button"
                              variant="light"
                            >
                              <Replace size={14} /> Replace
                            </Button>
                            <input
                              accept="image/jpeg,image/png,image/webp"
                              hidden
                              ref={(node) => {
                                replaceInputRefs.current[item.id] = node;
                              }}
                              type="file"
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                void replacePhoto(item, file);
                                event.target.value = "";
                              }}
                            />
                            <Button
                              onClick={() =>
                                patchItem(item.id, { isFeatured: !item.isFeatured }, "Featured flag updated.")
                              }
                              type="button"
                              variant="light"
                            >
                              <Star size={14} /> Featured
                            </Button>
                            <Button
                              onClick={() =>
                                patchItem(
                                  item.id,
                                  { isVisible: item.isVisible === false },
                                  "Library visibility updated.",
                                )
                              }
                              type="button"
                              variant="light"
                            >
                              {item.isVisible === false ? "Show" : "Hide"}
                            </Button>
                            <Button
                              disabled={removingId === item.id}
                              onClick={() => removePhoto(item)}
                              type="button"
                              variant="light"
                            >
                              <Trash2 size={14} /> {removingId === item.id ? "…" : "Delete"}
                            </Button>
                            <Link className="btn btn-light" href={item.image} target="_blank">
                              <Eye size={14} /> Preview
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length ? (
                  <tr>
                    <td colSpan={7}>No gallery photos yet. Upload above to populate the library.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
