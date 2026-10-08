import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaTelegram,
  FaXTwitter,
} from 'react-icons/fa6';
import { useDarkModeObserver } from '../helpers/useDarkModeObserver';
import { getBrandLogo } from '../helpers/brandAssets';
import { Button } from './Button';
import styles from './Footer.module.css';

const SOCIAL_LINKS = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/testkart',
    Icon: FaInstagram,
    tone: styles.tonePeach,
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/testkart',
    Icon: FaLinkedin,
    tone: styles.toneBlue,
  },
  {
    label: 'Facebook Group',
    href: 'https://www.facebook.com/groups/testkart/',
    Icon: FaFacebook,
    tone: styles.toneMint,
  },
  {
    label: 'Telegram',
    href: 'https://t.me/testkart_in',
    Icon: FaTelegram,
    tone: styles.toneBlue,
  },
  {
    label: 'X (Twitter)',
    href: 'https://x.com/testkart_in',
    Icon: FaXTwitter,
    tone: styles.toneLavender,
  },
];

export const Footer: React.FC = () => {
  const isDarkMode = useDarkModeObserver();
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.topRow}>
          <div className={styles.brand}>
            <Link to="/" className={styles.logo}>
              <img
                src={getBrandLogo(isDarkMode)}
                alt="Testkart"
                className={styles.logoImage}
              />
            </Link>
            <p className={styles.tagline}>Online marketplace connecting students with high-quality study materials, comprehensive courses, and mock tests created by expert teachers</p>
          </div>

          <div className={styles.cta}>
            <p className={styles.ctaText}>
              Create, sell and host mock tests and courses on Testkart.
            </p>
            <Button asChild size="lg" variant="primary" className={styles.ctaButton}>
              <Link to="/teach">
                Teach on Testkart
                <ArrowRight size={18} />
              </Link>
            </Button>
          </div>
        </div>

        <div className={styles.grid}>
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
            <ul className={styles.socialList}>
              {SOCIAL_LINKS.map(({ label, href, Icon, tone }) => (
                <li key={label}>
                  <a
                    href={href}
                    className={`${styles.socialLink} ${tone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                  >
                    <Icon size={20} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p className={styles.copyright}>
            Testkart&trade; is a registered trademark of Digikind Education Private Limited. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
