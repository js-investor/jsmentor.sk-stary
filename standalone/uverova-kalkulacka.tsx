import { createRoot } from "react-dom/client";
import "./standalone.css";
import PodlaPrijmuCalculator from "@/components/calculators/podlaprijmu/PodlaPrijmuCalculator";

createRoot(document.getElementById("root")!).render(<PodlaPrijmuCalculator />);
