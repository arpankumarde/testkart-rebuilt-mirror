import React from "react";
import { Link } from "react-router-dom";
import { FileQuestion, Home, Library } from "lucide-react";
import { Button } from "../components/Button";
import { SEOHead } from "../components/SEOHead";
import styles from "./$.module.css";

export default function NotFoundPage() {
  return (
    <div className={styles.container}>
      <SEOHead
        title="404 - Page Not Found"
        description="The page you are looking for does not exist on Testkart."
      />
      
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <FileQuestion className={styles.icon} strokeWidth={1.5} />
          <div className={styles.scoreBadge}>Score: 0 / 404</div>
        </div>
        
        <h1 className={styles.title}>Out of Syllabus!</h1>
        
        <p className={styles.description}>
          Looks like this question wasn't in the mock test. The page you are looking for has been moved, deleted, or never existed in the first place.
        </p>
        
        <div className={styles.actions}>
          <Button asChild size="lg" className={styles.primaryAction}>
            <Link to="/">
              <Home size={18} />
              Go to Homepage
            </Link>
          </Button>
          
          <Button asChild variant="outline" size="lg">
            <Link to="/mock-test">
              <Library size={18} />
              Browse Tests
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}