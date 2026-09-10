import { createRoot } from "react-dom/client";
import "./standalone.css";
import SkoringBytovCalculator from "@/components/calculators/skoring-bytov/SkoringBytovCalculator";

createRoot(document.getElementById("root")!).render(<SkoringBytovCalculator />);
