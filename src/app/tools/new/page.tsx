"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";

const CATEGORIES = [
  "Power Tools",
  "Hand Tools",
  "Gardening",
  "Automotive",
  "Electrical",
  "Plumbing",
  "Woodworking",
  "Measuring & Layout",
  "Safety Equipment",
  "Other",
];

export default function NewToolPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-16 bg-[#0a0a0a] border border-zinc-800">
        <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
        <p className="text-zinc-400 mb-6">Please sign in to lend a tool to the community.</p>
        <a
          href="/login"
          className="inline-block font-mono text-xs uppercase tracking-widest px-4 py-2 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer"
        >
          SIGN IN TO LEND
        </a>
      </div>
    );
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be less than 5MB");
        return;
      }
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        setError("Invalid image type. Use JPEG, PNG, GIF, or WebP");
        return;
      }
      setImage(file);
      setError("");
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Tool name is required");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    if (description.trim().length < 10) {
      setError("Description must be at least 10 characters");
      return;
    }
    if (!category) {
      setError("Please select a category");
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("description", description.trim());
    formData.append("category", category);
    if (image) {
      formData.append("image", image);
    }

    try {
      const res = await fetch("/api/tools/create", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        router.push(`/tools/${data.toolId}`);
        router.refresh();
      } else {
        setError(data.error || "Failed to create tool listing");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-3">NEW LISTING</p>
        <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">Lend a Tool</h1>
        <p className="mt-3 text-zinc-400 max-w-xl">
          Share your tools with the community. List what you have, set your terms, and help neighbors
          complete their projects.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/50 text-red-400 font-mono text-xs" role="alert">
            {error}
          </div>
        )}

        {/* Name */}
        <div>
          <label htmlFor="name" className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
            TOOL NAME <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., DeWalt 20V Max Cordless Drill"
            maxLength={100}
            required
            className="w-full bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
            CATEGORY <span className="text-red-400">*</span>
          </label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none appearance-none cursor-pointer"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
            DESCRIPTION <span className="text-red-400">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the tool's condition, capabilities, any accessories included, and any special instructions for borrowers..."
            rows={6}
            maxLength={2000}
            required
            className="w-full bg-black border border-zinc-800 rounded-none px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none resize-y min-h-[120px]"
          />
          <p className="mt-1 font-mono text-[11px] text-zinc-500 text-right">
            {description.length}/2000 characters (minimum 10)
          </p>
        </div>

        {/* Image Upload */}
        <div>
          <span className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
            TOOL PHOTO (OPTIONAL, MAX 5MB)
          </span>
          <div className="relative border border-zinc-800 bg-black">
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full h-auto object-contain max-h-64" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 p-2 bg-black border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  aria-label="Remove image"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="relative w-full h-40 flex flex-col items-center justify-center text-center">
                <p className="font-mono text-xs text-zinc-400">CLICK TO UPLOAD</p>
                <p className="font-mono text-[11px] text-zinc-600 mt-1">JPEG, PNG, GIF, WebP · MAX 5MB</p>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Upload tool photo"
                />
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors cursor-pointer"
          >
            CANCEL
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                CREATING LISTING...
              </>
            ) : (
              "CREATE LISTING"
            )}
          </button>
        </div>

        {/* Privacy Note */}
        <p className="font-mono text-[11px] text-zinc-500 text-center">
          ZERO-PII: Only your public alias and trust score are shown. No email, phone, or location shared.
        </p>
      </form>
    </div>
  );
}
