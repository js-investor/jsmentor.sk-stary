import { createRoot } from "react-dom/client";
import "./standalone.css";
import InvesticnaCalculator from "@/components/calculators/investicna/InvesticnaCalculator";

createRoot(document.getElementById("root")!).render(<InvesticnaCalculator />);
