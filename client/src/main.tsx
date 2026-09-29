import { createRoot } from "react-dom/client";
import App from "./App";
import { installImageUploadGuard } from "./lib/imageUploadGuard";
import "./index.css";

installImageUploadGuard();

createRoot(document.getElementById("root")!).render(<App />);
