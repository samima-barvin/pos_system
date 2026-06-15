import './App.css';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./components/Login";
import Sales from "./components/Sales";

function App() {
  return (
    <BrowserRouter>

      <Routes>

        <Route path="/login" element={<Login />} />
        <Route path="/sales" element={<Sales />} />
      </Routes>

    </BrowserRouter>
  );
}

export default App;