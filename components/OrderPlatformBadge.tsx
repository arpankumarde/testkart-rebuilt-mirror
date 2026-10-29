import React from "react";
import { Monitor, Smartphone, Tablet, CircleHelp } from "lucide-react";
import { FaAndroid, FaApple } from "react-icons/fa";
import { ORDER_PLATFORM_LABELS, type OrderPlatform } from "../helpers/orderAttribution";
import styles from "./OrderPlatformBadge.module.css";

const ICONS: Record<OrderPlatform, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  android_app: FaAndroid,
  ios_app: FaApple,
  mobile_web: Smartphone,
  tablet_web: Tablet,
  desktop_web: Monitor,
  unknown: CircleHelp,
};

const SHORT_LABELS: Record<OrderPlatform, string> = {
  android_app: "Android app",
  ios_app: "iOS app",
  mobile_web: "Mobile web",
  tablet_web: "Tablet web",
  desktop_web: "Desktop web",
  unknown: "Not captured",
};

export const OrderPlatformIcon: React.FC<{ platform: OrderPlatform; className?: string }> = ({ platform, className }) => {
  const Icon = ICONS[platform];
  return <Icon className={`${styles.icon} ${styles[platform]} ${className ?? ""}`} aria-hidden={true} />;
};

/** A compact, neutral chip: the icon carries the platform, the text names it. */
export const OrderPlatformBadge: React.FC<{ platform: OrderPlatform; className?: string }> = ({ platform, className }) => (
  <span
    className={`${styles.badge} ${platform === "unknown" ? styles.muted : ""} ${className ?? ""}`}
    title={ORDER_PLATFORM_LABELS[platform]}
  >
    <OrderPlatformIcon platform={platform} />
    {SHORT_LABELS[platform]}
  </span>
);