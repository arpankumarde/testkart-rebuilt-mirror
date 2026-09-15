import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Point, Area } from "react-easy-crop";
import { ZoomOut, ZoomIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./Dialog";
import { Button } from "./Button";
import { Slider } from "./Slider";
import styles from "./ImageCropDialog.module.css";

// Utility function to create an image from a URL
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous"); // needed to avoid cross-origin issues
    image.src = url;
  });

/**
 * Extracts a cropped image area using an HTML canvas.
 * Adapted from react-easy-crop examples.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  // set canvas size to match the bounding box
  canvas.width = image.width;
  canvas.height = image.height;

  // draw image
  ctx.drawImage(image, 0, 0);

  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  );

  // set canvas width to final desired crop size - this will clear existing context
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // paste generated image at the top left corner
  ctx.putImageData(data, 0, 0);

  // Return as a Blob
  return new Promise((resolve) => {
    canvas.toBlob(
      (file) => {
        resolve(file);
      },
      "image/jpeg",
      0.95 // Use high quality JPEG
    );
  });
}

export interface ImageCropDialogProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropConfirm: (croppedBlob: Blob) => void;
  aspect?: number;
  cropShape?: "rect" | "round";
}

export const ImageCropDialog: React.FC<ImageCropDialogProps> = ({
  open,
  onClose,
  imageSrc,
  onCropConfirm,
  aspect = 1,
  cropShape = "round",
}) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const onCropComplete = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleConfirm = useCallback(async () => {
    if (!croppedAreaPixels) return;

    try {
      setIsCropping(true);
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedImageBlob) {
        onCropConfirm(croppedImageBlob);
        onClose();
      }
    } catch (e) {
      console.error("Failed to crop image:", e);
    } finally {
      setIsCropping(false);
    }
  }, [croppedAreaPixels, imageSrc, onCropConfirm, onClose]);

  // Reset state when dialog opens with a new image
  React.useEffect(() => {
    if (open && imageSrc) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [open, imageSrc]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>

        <div className={styles.cropperContainer} style={{ aspectRatio: aspect }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
                        showGrid={false}
            objectFit="contain"
          />
        </div>

        <div className={styles.controlsContainer}>
          <ZoomOut className={styles.zoomIcon} />
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.1}
            onValueChange={(val) => setZoom(val[0])}
            className={styles.slider}
          />
          <ZoomIn className={styles.zoomIcon} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCropping}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isCropping}>
            {isCropping ? "Cropping..." : "Crop & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};