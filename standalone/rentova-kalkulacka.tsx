import { createRoot } from "react-dom/client";
import "./standalone.css";
import RentovaCalculator from "@/components/calculators/rentova/RentovaCalculator";

createRoot(document.getElementById("root")!).render(<RentovaCalculator />);
