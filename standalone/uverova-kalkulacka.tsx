import { createRoot } from "react-dom/client";
import "./standalone.css";
import UverovaCalculator from "@/components/calculators/uverova/UverovaCalculator";

createRoot(document.getElementById("root")!).render(<UverovaCalculator />);
