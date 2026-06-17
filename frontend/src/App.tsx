import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import "./App.css";

function App() {
  return (
    <div className="app">
      <div className="sidebar">
        <Sidebar />
      </div>

      <div className="main">
        <div className="navbar">
          <Navbar />
        </div>

        <div className="content">
          <Dashboard />
        </div>
      </div>
    </div>
  );
}

export default App;