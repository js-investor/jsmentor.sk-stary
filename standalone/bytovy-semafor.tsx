import { createRoot } from "react-dom/client";
import "./standalone.css";
import BytovySemaforCalculator from "@/components/calculators/bytovy-semafor/BytovySemaforCalculator";

createRoot(document.getElementById("root")!).render(<BytovySemaforCalculator />);
