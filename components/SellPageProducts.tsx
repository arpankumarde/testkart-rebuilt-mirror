import React from "react";
import { FileText, PlayCircle, BookOpen, Radio } from "lucide-react";
import { useInView } from "../helpers/useInView";
import styles from "./SellPageProducts.module.css";

export const SellPageProducts: React.FC = () => {
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.1 });

  const products = [
    {
      id: "mock-tests",
      title: "Mock Test Series",
      description: "Create unlimited tests with AI assistance. The core of your teaching business.",
      stat: "70% of teacher earnings",
      icon: <FileText size={32} />,
      badge: "Most Popular",
      color: "var(--primary)",
    },
    {
      id: "video-courses",
      title: "Video Courses",
      description: "Upload comprehensive video lessons with chapters. Build recurring student relationships.",
      stat: "High retention rate",
      icon: <PlayCircle size={32} />,
      color: "#23a6d5",
    },
    {
      id: "digital-products",
      title: "Digital Products",
      description: "Sell PDFs, handwritten notes, and study materials. One-time upload, unlimited sales.",
      stat: "100% passive income",
      icon: <BookOpen size={32} />,
      color: "#a855f7",
    },
    {
      id: "live-tests",
      title: "Live Mock Tests",
      description: "Host real-time competitive tests. Engage students with live leaderboards & prizes.",
      stat: "Viral growth tool",
      icon: <Radio size={32} />,
      color: "#ef4444",
    },
      ];

  return (
    <section className={styles.section} ref={ref}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            Everything You Need to Build Your <span className={styles.gradientText}>Teaching Empire Online</span>
          </h2>
          <p className={styles.subtitle}>
            Multiple revenue streams, one powerful platform. Diversify your income with our comprehensive suite of tools.
          </p>
        </div>

        <div className={styles.grid}>
          {products.map((product, index) => (
            <div
              key={product.id}
              className={`${styles.card} ${inView ? styles.animateUp : ""}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              {product.badge && (
                <div className={styles.badge}>{product.badge}</div>
              )}
              
              <div 
                className={styles.iconWrapper}
                style={{ color: product.color, borderColor: `${product.color}40`, background: `${product.color}10` }}
              >
                {product.icon}
              </div>
              
              <h3 className={styles.cardTitle}>{product.title}</h3>
              <p className={styles.cardDescription}>{product.description}</p>
              
              <div className={styles.cardStat}>
                <span className={styles.statDot} style={{ background: product.color }}></span>
                {product.stat}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};