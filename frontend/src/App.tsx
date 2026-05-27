import DropzoneArea from "./components/DropzoneArea";
import { useFileStore } from "./store/useFileStore";
import "./styles.css";

export const App = () => {
  const files = useFileStore((state) => state.files);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Socks on Stocks</h1>
          <p>Workspace import foundation</p>
        </div>
        <span className="file-counter">{files.length} selected</span>
      </header>

      <DropzoneArea />
    </main>
  );
};

export default App;
