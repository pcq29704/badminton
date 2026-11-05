"use client";

import { useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { Button, Card, Notice } from "@/components/ui";

const OUTPUT_SIZE = 512;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read the image."));
    image.src = src;
  });
}

// Draws the chosen area onto a square canvas and returns it as a JPEG file.
async function cropToFile(src, area, name) {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  canvas.getContext("2d").drawImage(image, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Could not crop the image.");
  return new File([blob], `${name.replace(/\.[^.]+$/, "") || "profile"}.jpg`, { type: "image/jpeg" });
}

// Lets the player drag and zoom the chosen photo inside a round frame before it is uploaded. Escape cancels.
export default function ImageCropper({ file, onCancel, onConfirm }) {
  const [src, setSrc] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function confirm() {
    if (!area || working) return;
    setWorking(true);
    try {
      onConfirm(await cropToFile(src, area, file.name));
    } catch (caught) {
      setError(caught.message);
      setWorking(false);
    }
  }

  return <div className="cb-crop" role="dialog" aria-modal="true" aria-labelledby="crop-title" onKeyDown={(event) => { if (event.key === "Escape" && !working) onCancel(); }}>
    <Card as="div" className="cb-crop-card">
      <h2 className="cb-title" id="crop-title">Crop your picture</h2>
      <p className="cb-note">Drag to move. Use the slider to zoom.</p>
      <div className="cb-crop-stage">
        {src && <Cropper image={src} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)} />}
      </div>
      <label className="cb-label" htmlFor="crop-zoom">Zoom</label>
      <input className="cb-crop-zoom" id="crop-zoom" type="range" min={1} max={3} step={0.01} value={zoom} autoFocus onChange={(event) => setZoom(Number(event.target.value))} />
      <Notice tone="error">{error}</Notice>
      <div className="cb-crop-actions">
        <Button variant="quiet" onClick={onCancel} disabled={working}>Cancel</Button>
        <Button onClick={confirm} disabled={working || !area}>{working ? "Saving…" : "Save picture"}</Button>
      </div>
    </Card>
  </div>;
}
