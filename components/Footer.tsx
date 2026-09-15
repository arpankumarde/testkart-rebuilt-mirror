import React from 'react';
import { Link } from 'react-router-dom';
import {
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaTelegram,
  FaXTwitter,
} from 'react-icons/fa6';
import { useDarkModeObserver } from '../helpers/useDarkModeObserver';
import { getBrandLogo } from '../helpers/brandAssets';
import styles from './Footer.module.css';

export const Footer: React.FC = () => {
  const isDarkMode = useDarkModeObserver();
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.grid}>
          <div className={styles.brandColumn}>
            <Link to="/" className={styles.logo}>
              <img
                src={getBrandLogo(isDarkMode)}
                alt="Testkart"
                className={styles.logoImage}
              />
            </Link>
            <p className={styles.tagline}>Online marketplace connecting students with high-quality study materials, comprehensive courses, and mock tests created by expert teachers</p>
          </div>

          <div className={styles.linksColumn}>
            <h3 className={styles.columnTitle}>Legal</h3>
            <ul className={styles.linkList}>
              <li><Link to="/terms" className={styles.footerLink}>Terms & Conditions</Link></li>
              <li><Link to="/privacy" className={styles.footerLink}>Privacy Policy</Link></li>
              <li><Link to="/refund" className={styles.footerLink}>Refund Policy</Link></li>
            </ul>
          </div>

          <div className={styles.linksColumn}>
            <h3 className={styles.columnTitle}>Platform Features</h3>
            <ul className={styles.linkList}>
              <li>
                <Link to="/bundles" className={styles.footerLink}>
                  Course Bundles
                </Link>
              </li>
              <li>
                <Link to="/sell/host-live-exam" className={styles.footerLink}>
                  Create & Host Live Mock Test
                </Link>
              </li>
              <li>
                <Link to="/sell/mock-test" className={styles.footerLink}>
                  Create & Sell Mock Tests
                </Link>
              </li>
              <li>
                <Link to="/sell/study-notes-pdfs" className={styles.footerLink}>
                  Sell Digital Products
                </Link>
              </li>
              <li>
                <Link to="/sell/courses" className={styles.footerLink}>
                  Create & Sell Online Courses
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles.linksColumn}>
            <h3 className={styles.columnTitle}>Company</h3>
            <ul className={styles.linkList}>
              <li><Link to="/about" className={styles.footerLink}>About Us</Link></li>
              <li><Link to="/blog" className={styles.footerLink}>Blog</Link></li>
              <li><Link to="/news-and-events" className={styles.footerLink}>News & Events</Link></li>
              <li><Link to="/help" className={styles.footerLink}>Help Doc</Link></li>
              <li><Link to="/contact" className={styles.footerLink}>Contact Us</Link></li>
              <li><Link to="/careers" className={styles.footerLink}>Careers</Link></li>
              <li><Link to="/sell/mock-test" className={styles.footerLink}>Pricing</Link></li>
              <li><Link to="/exams" className={styles.footerLink}>Exams</Link></li>
            </ul>
          </div>

          <div className={styles.linksColumn}>
            <h3 className={styles.columnTitle}>Compare</h3>
            <ul className={styles.linkList}>
              <li><Link to="/compare/classplus-vs-testkart" className={styles.footerLink}>Classplus vs Testkart</Link></li>
              <li><Link to="/compare/learnyst-vs-testkart" className={styles.footerLink}>Learnyst vs Testkart</Link></li>
              <li><Link to="/compare/tagmango-vs-testkart" className={styles.footerLink}>TagMango vs Testkart</Link></li>
              <li><Link to="/compare/graphy-vs-testkart" className={styles.footerLink}>Graphy vs Testkart</Link></li>
            </ul>
          </div>

          <div className={styles.linksColumn}>
            <h3 className={styles.columnTitle}>Connect With Us</h3>
            <ul className={styles.linkList}>
              <li>
                <a
                  href="https://t.me/testkart_in"
                  className={styles.footerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FaTelegram size={16} />
                  Telegram
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/testkart"
                  className={styles.footerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FaInstagram size={16} />
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://x.com/testkart_in"
                  className={styles.footerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FaXTwitter size={16} />
                  X (Twitter)
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/groups/testkart/"
                  className={styles.footerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FaFacebook size={16} />
                  Facebook Group
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/testkart"
                  className={styles.footerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FaLinkedin size={16} />
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p className={styles.copyright}>
            &copy; {new Date().getFullYear()} Testkart (Digikind Education Private Limited). All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};