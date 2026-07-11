"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublicGalleryItem } from "@/lib/gallery";

type GalleryResponse = {
  success: boolean;
  items?: PublicGalleryItem[];
  message?: string;
};

export function AdminGalleryManager({ initialItems }: { initialItems: PublicGalleryItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function refreshGallery() {
    const response = await fetch("/api/gallery");
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
    setStatus("Photo added to the public gallery.");
    setIsSubmitting(false);
  }

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Content</span>
          <h1>Gallery Manager</h1>
        </div>
        <button className="icon-btn" aria-label="Refresh gallery" onClick={refreshGallery} type="button">
          <RefreshCw size={17} />
        </button>
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
            <span>Photo</span>
            <Input accept="image/jpeg,image/png,image/webp" name="file" required type="file" />
          </label>
          {status ? <p className={status.includes("failed") || status.includes("required") ? "form-error" : "form-success"}>{status}</p> : null}
          <Button disabled={isSubmitting} type="submit">
            <ImagePlus size={16} /> {isSubmitting ? "Uploading..." : "Add to Gallery"}
          </Button>
        </form>

        <section className="panel">
          <h2>Public Gallery Photos</h2>
          <div className="admin-gallery-grid">
            {items.map((item) => (
              <figure className="gallery-card" key={item.id}>
                <img alt={`${item.title} event design`} src={item.image} />
                <figcaption>
                  <small>{item.category}</small>
                  <strong>{item.title}</strong>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
