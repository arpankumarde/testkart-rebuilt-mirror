import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X, Radio } from "lucide-react";
import { Button } from "./Button";
import styles from "./MobileNav.module.css";

export const MobileNav: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-md"
        onClick={toggleMenu}
        className={styles.hamburger}
        aria-label="Toggle menu"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </Button>

      {isOpen && (
        <>
          <div className={styles.overlay} onClick={closeMenu} />
          <nav className={styles.mobileNav}>
            <div className={styles.mobileNavContent}>
              <NavLink
                to="/exams"
                className={({ isActive }) =>
                  `${styles.mobileNavLink} ${isActive ? styles.active : ""}`
                }
                onClick={closeMenu}
              >
                Exams
              </NavLink>
              
              <NavLink
                to="/mock-test"
                className={({ isActive }) =>
                  `${styles.mobileNavLink} ${isActive ? styles.active : ""}`
                }
                onClick={closeMenu}
              >
                Test Series
              </NavLink>
              <NavLink
                to="/mock-test/live"
                className={({ isActive }) =>
                  `${styles.mobileNavLink} ${styles.liveTestsLink} ${isActive ? styles.active : ""}`
                }
                onClick={closeMenu}
              >
                <div className={styles.liveIndicatorWrapper}>
                  <Radio size={20} className={styles.liveIcon} />
                  <span className={styles.liveDot}></span>
                </div>
                <span>Live Competitions</span>
              </NavLink>
            </div>
          </nav>
        </>
      )}
    </>
  );
};