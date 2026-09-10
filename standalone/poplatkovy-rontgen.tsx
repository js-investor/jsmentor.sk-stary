import { createRoot } from "react-dom/client";
import "./standalone.css";
import PoplatkovyRontgenCalculator from "@/components/calculators/poplatkovy-rontgen/PoplatkovyRontgenCalculator";

createRoot(document.getElementById("root")!).render(<PoplatkovyRontgenCalculator />);
