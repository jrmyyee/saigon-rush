import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GameScreen } from "./pages/GameScreen";
import { Controller } from "./pages/Controller";
import { Audience } from "./pages/Audience";
import { Results } from "./pages/Results";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GameScreen />} />
        <Route path="/play" element={<GameScreen />} />
        <Route path="/control" element={<Controller />} />
        <Route path="/audience" element={<Audience />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </BrowserRouter>
  );
}
