import React from 'react';
import { Link } from 'react-router-dom';
import { Store } from 'lucide-react';
import styles from './FloatingSellButton.module.css';

export const FloatingSellButton: React.FC = () => {
  return (
    <Link 
      to="/sell"
      className={styles.floatingButton} 
      aria-label="Sell on Testkart"
    >
      <Store size={20} />
      <span className={styles.buttonText}>Sell on Testkart</span>
    </Link>
  );
};