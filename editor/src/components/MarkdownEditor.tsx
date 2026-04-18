import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { Markdown } from "tiptap-markdown";
import { createLowlight, common } from "lowlight";
import {
  Bold, Italic, Strikethrough, Code, Link as LinkIcon, List, ListOrdered,
  Quote, Heading1, Heading2, Heading3, Image as ImageIcon, Minus, Table as TableIcon,
  Undo2, Redo2,
} from "lucide-react";
import { api } from "@/lib/api";

const lowlight = createLowlight(common);

interface Props {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}

function ToolbarButton({
  onClick, active, disabled, label, children,
}: { onClick: () => void; active?: boolean; disabled?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-active={active || undefined} title={label} aria-label={label}>
      {children}
    </button>
  );
}

function Divider() { return <div className="tiptap-toolbar-sep" />; }

function Toolbar({ editor }: { editor: Editor }) {
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleImageUpload(files: FileList | null) {
    if (!files || !files.length) return;
    const [uploaded] = await api.uploadImages([files[0]]);
    if (uploaded) editor.chain().focus().setImage({ src: uploaded.path }).run();
  }

  function promptLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  if (!editor) return null;
  return (
    <div className="tiptap-toolbar" role="toolbar" aria-label="Editor toolbar">
      <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></ToolbarButton>
      <Divider />
      <ToolbarButton label="H1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={15} /></ToolbarButton>
      <ToolbarButton label="H2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></ToolbarButton>
      <ToolbarButton label="H3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={15} /></ToolbarButton>
      <Divider />
      <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></ToolbarButton>
      <ToolbarButton label="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Code size={15} /></ToolbarButton>
      <ToolbarButton label="Link" active={editor.isActive("link")} onClick={promptLink}><LinkIcon size={15} /></ToolbarButton>
      <Divider />
      <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolbarButton>
      <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></ToolbarButton>
      <ToolbarButton label="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code size={15} /></ToolbarButton>
      <ToolbarButton label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={15} /></ToolbarButton>
      <Divider />
      <ToolbarButton label="Insert image" onClick={() => fileInput.current?.click()}><ImageIcon size={15} /></ToolbarButton>
      <ToolbarButton label="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={15} /></ToolbarButton>
      <input
        ref={fileInput}
        type="file" accept="image/*" hidden
        onChange={(e) => { handleImageUpload(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}

export function MarkdownEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({ placeholder: placeholder || "Write your post…" }),
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: "text" }),
      Table.configure({ resizable: false }),
      TableRow, TableHeader, TableCell,
      Markdown.configure({ html: true, tightLists: true, breaks: false, linkify: true, transformPastedText: true }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const md: string = editor.storage.markdown.getMarkdown();
      onChange(md);
    },
  });

  // Sync incoming value when loading a different post
  useEffect(() => {
    if (!editor) return;
    const current: string = editor.storage.markdown.getMarkdown();
    if (current !== value) {
      editor.commands.setContent(value, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return <div className="tiptap-wrap"><div className="p-6 text-zinc-400">Loading editor…</div></div>;

  return (
    <div className="tiptap-wrap">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="flex-1" />
    </div>
  );
}
