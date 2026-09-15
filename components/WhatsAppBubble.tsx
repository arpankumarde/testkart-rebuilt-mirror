import React from "react";
import { FaWhatsapp } from "react-icons/fa6";
import styles from "./WhatsAppBubble.module.css";

export function WhatsAppBubble({ className }: { className?: string }) {
  return (
    <a
      href="https://wa.me/+919654548384"
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.container} ${className ?? ""}`}
      aria-label="Chat with us on WhatsApp"
    >
      <FaWhatsapp className={styles.icon} aria-hidden="true" />
    </a>
  );
}
