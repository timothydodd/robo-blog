import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { PostsList } from "@/routes/PostsList";
import { PostEdit } from "@/routes/PostEdit";
import { Tags } from "@/routes/Tags";
import { Images } from "@/routes/Images";
import { Settings } from "@/routes/Settings";
import { ToastProvider } from "@/components/ui/Toast";

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/posts" replace />} />
            <Route path="/posts" element={<PostsList kind="posts" />} />
            <Route path="/posts/:slug" element={<PostEdit kind="posts" />} />
            <Route path="/pages" element={<PostsList kind="pages" />} />
            <Route path="/pages/:slug" element={<PostEdit kind="pages" />} />
            <Route path="/tags" element={<Tags />} />
            <Route path="/images" element={<Images />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
