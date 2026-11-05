import React from "react";
import { Helmet } from "react-helmet";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { AdminTcoinsSettings } from "../components/AdminTcoinsSettings";
import styles from "./admin.tcoins.module.css";

const AdminTcoinsPage: React.FC = () => (
  <>
    <Helmet>
      <title>Tcoins - Testkart Admin</title>
      <meta name="description" content="Tcoins cashback and spend limits for Testkart students." />
    </Helmet>
    <div className={styles.page}>
      <ConsolePageHeader
        title="Tcoins"
        description="Coins students earn as cashback and spend on part of an order. They can't be withdrawn or combined with a coupon, and Testkart covers the coins spent, so teacher earnings stay on the full price."
      />
      <AdminTcoinsSettings />
    </div>
  </>
);

export default AdminTcoinsPage;