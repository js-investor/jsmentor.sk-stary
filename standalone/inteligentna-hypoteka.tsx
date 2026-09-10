import { createRoot } from "react-dom/client";
import "./standalone.css";
import InteligentnaHypotekaCalculator from "@/components/calculators/inteligentna-hypoteka/InteligentnaHypotekaCalculator";

createRoot(document.getElementById("root")!).render(<InteligentnaHypotekaCalculator />);
