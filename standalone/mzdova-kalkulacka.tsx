import { createRoot } from "react-dom/client";
import "./standalone.css";
import MzdovaCalculator from "@/components/calculators/mzdova/MzdovaCalculator";

createRoot(document.getElementById("root")!).render(<MzdovaCalculator />);
