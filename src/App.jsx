import { Routes, Route } from "react-router";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Editor from "@/pages/Editor";
import MyMemes from "@/pages/MyMemes";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/my-memes" element={<MyMemes />} />
      </Routes>
    </Layout>
  );
}

export default App;
