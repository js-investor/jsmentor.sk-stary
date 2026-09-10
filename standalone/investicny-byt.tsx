import { createRoot } from "react-dom/client";
import "./standalone.css";
import InvesticnyBytCalculator from "@/components/calculators/investicny-byt/InvesticnyBytCalculator";

createRoot(document.getElementById("root")!).render(<InvesticnyBytCalculator />);
