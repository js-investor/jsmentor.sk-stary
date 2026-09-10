import { createRoot } from "react-dom/client";
import "./standalone.css";
import FinancnyCheckup from "@/components/checkup/FinancnyCheckup";

createRoot(document.getElementById("root")!).render(<FinancnyCheckup />);
