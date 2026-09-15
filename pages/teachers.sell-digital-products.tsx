import { Navigate } from "react-router-dom";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import styles from "./teachers.sell-digital-products.module.css";

export default function TeachersSellDigitalProductsRedirectPage() {
  return <Navigate to="/sell/study-notes-pdfs" replace={true} />;
}