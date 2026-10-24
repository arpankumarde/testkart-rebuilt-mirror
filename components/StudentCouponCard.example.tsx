import { Example, Screens } from "@floot/examples";
import { StudentCouponCard } from "./StudentCouponCard";
import { StudentCouponDetailsDialog } from "./StudentCouponDetailsDialog";
import StudentCouponsPage from "../pages/student.coupons";
import { exampleCoupons } from "../helpers/spinWinExampleData";
import styles from "./StudentCouponCard.example.module.css";

const [percent, flat, redeemed, expired] = exampleCoupons;
const pendingCoupon = { ...flat, id: 5, code: "DIWALI-EXAMPLE5", status: "reserved" as const };

export default function Showcase() {
  return (
    <>
      <h1>StudentCouponCard</h1>
      <p>One reward coupon in the student's My Coupons wallet, with its details modal. Used and lapsed coupons stay listed in a quieter style.</p>

      <Screens title="My Coupons">
        <Example title="Wallet" backend={{ "spin-win/my-coupons_GET": { coupons: exampleCoupons } }}>
          <StudentCouponsPage />
        </Example>
        <Example title="No coupons yet" backend={{ "spin-win/my-coupons_GET": { coupons: [] } }}>
          <StudentCouponsPage />
        </Example>
        <Example title="Details - available">
          <StudentCouponDetailsDialog coupon={flat} onClose={() => {}} />
        </Example>
        <Example title="Details - redeemed">
          <StudentCouponDetailsDialog coupon={redeemed} onClose={() => {}} />
        </Example>
        <Example title="Details - expired">
          <StudentCouponDetailsDialog coupon={expired} onClose={() => {}} />
        </Example>
      </Screens>

      <h2>Card states</h2>
      <div className={styles.grid}>
        <Example title="Available, percentage">
          <StudentCouponCard coupon={percent} onDetails={() => {}} />
        </Example>
        <Example title="Available, flat with minimum">
          <StudentCouponCard coupon={flat} onDetails={() => {}} />
        </Example>
        <Example title="Payment pending">
          <StudentCouponCard coupon={pendingCoupon} onDetails={() => {}} />
        </Example>
        <Example title="Redeemed">
          <StudentCouponCard coupon={redeemed} onDetails={() => {}} />
        </Example>
        <Example title="Expired">
          <StudentCouponCard coupon={expired} onDetails={() => {}} />
        </Example>
      </div>
    </>
  );
}
