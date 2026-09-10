import { createRoot } from "react-dom/client";
import "./standalone.css";
import EtfSemaforCalculator from "@/components/calculators/etf-semafor/EtfSemaforCalculator";

createRoot(document.getElementById("root")!).render(<EtfSemaforCalculator />);
