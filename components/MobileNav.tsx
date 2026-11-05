import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X, Users } from "lucide-react";
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
                to="/expert"
                className={({ isActive }) =>
                  `${styles.mobileNavLink} ${isActive ? styles.active : ""}`
                }
                onClick={closeMenu}
              >
                <Users size={20} />
                <span>Tutors</span>
              </NavLink>
            </div>
          </nav>
        </>
      )}
    </>
  );
};