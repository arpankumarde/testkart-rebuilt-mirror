import { defineScreens, httpError, pending } from "@floot/examples";
import type { OutputType as Session } from "../endpoints/auth/session_GET.schema";
import { exampleCoupons, exampleStudentSession } from "../helpers/spinWinExampleData";

export default defineScreens({
  backend: {
    "auth/session_GET": exampleStudentSession as Session,
  },
  screens: [
    { title: "Coupons", backend: { "spin-win/my-coupons_GET": { coupons: exampleCoupons } } },
    { title: "No coupons yet", backend: { "spin-win/my-coupons_GET": { coupons: [] } } },
    { title: "Loading", backend: { "spin-win/my-coupons_GET": pending } },
    { title: "Load failed", backend: { "spin-win/my-coupons_GET": httpError(500) } },
  ],
});