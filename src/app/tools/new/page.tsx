"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Hammer, X, Check, Loader2, Image, AlertTriangle } from "lucide-react";

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
      <div className="text-center py-16 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl">
        <Hammer className="w-16 h-16 mx-auto text-slate-600 mb-4" aria-hidden="true" />
        <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
        <p className="text-slate-400 mb-6">Please sign in to lend a tool to the community.</p>
        <a
          href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200"
        >
          <Hammer className="w-4 h-4" aria-hidden="true" />
          Sign In to Lend
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
      <div className="text-center">
        <Hammer className="w-16 h-16 mx-auto text-cyan-400 mb-4" aria-hidden="true" />
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-400 bg-clip-text text-transparent">
          Lend a Tool
        </h1>
        <p className="mt-3 text-slate-400 max-w-xl mx-auto">
          Share your tools with the community. List what you have, set your terms, and help neighbors complete their projects.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
            Tool Name <span className="text-rose-400">*</span>
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
            className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-2">
            Category <span className="text-rose-400">*</span>
          </label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-3 text-sm text-slate-100 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all cursor-pointer"
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
          <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-2">
            Description <span className="text-rose-400">*</span>
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
            className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all resize-y min-h-[120px]"
          />
          <p className="mt-1 text-xs text-slate-500 text-right">
            {description.length}/2000 characters (minimum 10)
          </p>
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Tool Photo (Optional, max 5MB)
          </label>
          <div className="relative">
            <div
              className={`relative aspect-video rounded-xl border-2 border-dashed transition-all ${
                imagePreview
                  ? "border-cyan-500/50 bg-slate-900/50"
                  : "border-white/10 hover:border-cyan-500/30 bg-slate-950/50"
              }`}
              onClick={() => !imagePreview && document.getElementById("image-upload")?.click()}
            >
              {imagePreview ? (
                <>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeImage(); }}
                    className="absolute top-3 right-3 p-2 rounded-full bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors"
                    aria-label="Remove image"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                  <Image className="w-12 h-12 text-slate-500 mb-3" aria-hidden="true" />
                  <p className="text-slate-400">Click to upload or drag & drop</p>
                  <p className="text-xs text-slate-600 mt-1">JPEG, PNG, GIF, WebP · Max 5MB</p>
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
        </div>

        {/* Submit */}
        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-6 py-3 rounded-xl font-medium text-sm bg-slate-800/50 border border-white/10 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Creating Listing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                Create Listing
              </>
            )}
          </button>
        </div>

        {/* Privacy Note */}
        <p className="text-xs text-slate-500 text-center">
          Zero-PII: Only your public alias and trust score are shown. No email, phone, or location shared.
        </p>
      </form>
    </div>
  );
}