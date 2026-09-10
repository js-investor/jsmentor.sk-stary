import { createRoot } from "react-dom/client";
import "./standalone.css";
import VynosnostBytuCalculator from "@/components/calculators/vynosnost-bytu/VynosnostBytuCalculator";

createRoot(document.getElementById("root")!).render(<VynosnostBytuCalculator />);
