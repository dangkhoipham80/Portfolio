import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import CareerJourney from "./pages/CareerJourney";
import Certificates from "./pages/Certificates";

function App() {
  // The animated background is rendered by each page, not here — rendering it in
  // both places mounted two layers with two rAF loops running at the same time.
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route index element={<Home />} />
          <Route path="/career-journey" element={<CareerJourney />} />
          <Route path="/certificates" element={<Certificates />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
