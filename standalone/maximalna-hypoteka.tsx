import { createRoot } from "react-dom/client";
import "./standalone.css";
import MaxHypotekaCalculator from "@/components/calculators/maxhypoteka/MaxHypotekaCalculator";

createRoot(document.getElementById("root")!).render(<MaxHypotekaCalculator />);
